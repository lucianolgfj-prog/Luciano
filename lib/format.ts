export const money = (n: number | { toString(): string }) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(n),
  );
export const date = (d: Date | string | null | undefined) =>
  d
    ? new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
      }).format(new Date(d))
    : "Não informada";
export const labels: Record<string, string> = {
  ADMIN: "Administrador",
  COMMERCIAL: "Comercial",
  LEGAL: "Jurídico",
  PENDING: "Pendente",
  IN_PROGRESS: "Em andamento",
  DONE: "Concluída",
  APPROVED: "Aprovada",
  REJECTED: "Descartada",
  LEAD: "Lead",
  MEETING: "Reunião",
  PROPOSAL: "Proposta",
  WON: "Ganha",
  LOST: "Perdida",
  SENT: "Enviada",
  FAILED: "Falha",
  PROCESSING: "Em envio",
};
export function safeLink(url: string) {
  try {
    const u = new URL(url);
    return (u.protocol === "https:" &&
      [
        "notion.so",
        "www.notion.so",
        "app.notion.com",
        "outlook.office365.com",
        "outlook.office.com",
      ].includes(u.hostname)) ||
      (u.protocol === "https:" &&
        (u.hostname.endsWith(".sharepoint.com") ||
          u.hostname === "onedrive.live.com"))
      ? u.href
      : null;
  } catch {
    return null;
  }
}

export function dateInput(d: Date | null | undefined) {
  if (!d) return "";
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const part = (type: string) => p.find((v) => v.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
