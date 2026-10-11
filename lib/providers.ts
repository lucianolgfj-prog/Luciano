import ExcelJS from "exceljs";
export class ProviderError extends Error {
  constructor(
    public provider: string,
    public code: number,
  ) {
    super(
      `${provider}: resposta ${code}. Verifique configuração e permissões.`,
    );
  }
}
export const required = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`Configuração ausente: ${name}.`);
  return v;
};
export async function jsonRequest(
  url: string,
  init: RequestInit = {},
  provider = "API",
) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!response.ok) throw new ProviderError(provider, response.status);
  return response.json();
}
export async function graphToken() {
  return (
    await jsonRequest(
      `https://login.microsoftonline.com/${encodeURIComponent(required("GRAPH_TENANT_ID"))}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: required("GRAPH_CLIENT_ID"),
          client_secret: required("GRAPH_CLIENT_SECRET"),
          scope: "https://graph.microsoft.com/.default",
          grant_type: "client_credentials",
        }),
      },
      "Entra",
    )
  ).access_token as string;
}
export function graphURL(path: string) {
  const url = new URL(
    path.startsWith("https:")
      ? path
      : `https://graph.microsoft.com/v1.0/${path}`,
  );
  if (
    url.origin !== "https://graph.microsoft.com" ||
    !url.pathname.startsWith("/v1.0/")
  )
    throw new Error("URL Graph não permitida.");
  return url.href;
}
export const graph = (token: string, path: string) =>
  jsonRequest(
    graphURL(path),
    { headers: { Authorization: `Bearer ${token}` } },
    "Graph",
  );
export const notion = (path: string, body?: unknown) =>
  jsonRequest(
    `https://api.notion.com/v1/${path}`,
    {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${required("NOTION_TOKEN")}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    "Notion",
  );
export type NotionPage = {
  id: string;
  url: string;
  created_time: string;
  last_edited_time: string;
  properties: Record<
    string,
    {
      type: string;
      title?: { plain_text: string }[];
      rich_text?: { plain_text: string }[];
      status?: { name: string };
      select?: { name: string };
      date?: { start: string };
    }
  >;
};
export function propertyText(p: NotionPage, name: string) {
  const field = p.properties[name];
  return (field?.title ?? field?.rich_text ?? [])
    .map((t) => t.plain_text)
    .join("");
}
export async function readLeadRows(token: string) {
  const drive = required("ONEDRIVE_DRIVE_ID"),
    item = required("ONEDRIVE_LEADS_ITEM_ID");
  // Graph /content redirige para URL temporária. Não encaminhar Authorization ao destino.
  const initial = await fetch(
    graphURL(
      `drives/${encodeURIComponent(drive)}/items/${encodeURIComponent(item)}/content`,
    ),
    {
      headers: { Authorization: `Bearer ${token}` },
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    },
  );
  let response = initial;
  if ([301, 302, 303, 307, 308].includes(initial.status)) {
    const location = initial.headers.get("location");
    if (!location) throw new Error("Download OneDrive sem destino.");
    const url = new URL(location);
    if (
      url.protocol !== "https:" ||
      !(
        url.hostname.endsWith(".sharepoint.com") ||
        url.hostname === "public.dm.files.1drv.com" ||
        url.hostname.endsWith(".files.1drv.com")
      )
    )
      throw new Error("Destino de download OneDrive não permitido.");
    response = await fetch(url, {
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
  }
  if (!response.ok) throw new ProviderError("OneDrive", response.status);
  const max = 10 * 1024 * 1024;
  if (Number(response.headers.get("content-length") ?? 0) > max)
    throw new Error("Planilha excede 10 MB.");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Download vazio.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const r = await reader.read();
    if (r.done) break;
    total += r.value.byteLength;
    if (total > max) {
      await reader.cancel();
      throw new Error("Planilha excede 10 MB.");
    }
    chunks.push(r.value);
  }
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.concat(chunks) as unknown as ExcelJS.Buffer);
  const tableName = process.env.ONEDRIVE_LEADS_TABLE ?? "Leads";
  let rows: unknown[][] | undefined;
  for (const sheet of workbook.worksheets) {
    const table = sheet.getTable(tableName);
    if (table) {
      const data = (table as unknown as { model: unknown }).model as {
        columns: { name: string }[];
        rows: unknown[][];
      };
      rows = [data.columns.map((c) => c.name), ...data.rows];
      break;
    }
  }
  if (!rows)
    throw new Error(`Tabela nomeada ${tableName} não encontrada na planilha.`);
  const headers = rows[0].map(String);
  if (!headers.includes("Nome") || !headers.includes("Email"))
    throw new Error("A tabela de leads precisa das colunas Nome e Email.");
  return rows.slice(1).map((row, index) => ({
    row: index + 1,
    name: String(row[headers.indexOf("Nome")] ?? "").trim(),
    email: String(row[headers.indexOf("Email")] ?? "")
      .trim()
      .toLowerCase(),
    phone: String(row[headers.indexOf("Telefone")] ?? ""),
    stage: String(row[headers.indexOf("Etapa")] ?? "Lead"),
  }));
}
