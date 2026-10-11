import { admin } from "@/lib/auth";
import { db } from "@/lib/db";
import { externalWritesAllowed } from "@/lib/policy";
import { date } from "@/lib/format";
import { runSync, linkImported, acceptNotionSource } from "@/app/actions";
import { Shell } from "@/components/shell";
import { Panel, Empty, PageHeading, Badge } from "@/components/ui";
export default async function Integrations() {
  const user = await admin();
  const [states, jobs, docs, meetings, tasks, clients, conflicts] =
    await Promise.all([
      db.syncState.findMany(),
      db.outbox.findMany({
        where: { task: { isDemo: user.isDemo } },
        include: { task: true },
        take: 100,
        orderBy: { nextAttemptAt: "asc" },
      }),
      db.document.findMany({
        where: { isDemo: user.isDemo, clientId: null },
        take: 100,
      }),
      db.meeting.findMany({
        where: { isDemo: user.isDemo, clientId: null },
        take: 100,
      }),
      db.task.findMany({
        where: {
          isDemo: user.isDemo,
          clientId: null,
          notionPageId: { not: null },
        },
        take: 100,
      }),
      db.client.findMany({
        where: { isDemo: user.isDemo },
        orderBy: { name: "asc" },
      }),
      db.task.findMany({
        where: { isDemo: user.isDemo, source: "NOTION", localDirty: true },
        take: 100,
      }),
    ]);
  const configs = [
    {
      key: "outlook",
      name: "Outlook · Jusbrasil",
      description:
        "Leitura da caixa profissional, filtro de destinatário jurídico e triagem preliminar.",
      vars: [
        "GRAPH_TENANT_ID",
        "GRAPH_CLIENT_ID",
        "GRAPH_CLIENT_SECRET",
        "OUTLOOK_MAILBOX",
        "JUSBRASIL_SENDER",
      ],
    },
    {
      key: "onedrive",
      name: "OneDrive · documentos e leads",
      description:
        "Metadados por delta; importação opcional de tabela Excel. Vínculos são confirmados manualmente.",
      vars: [
        "GRAPH_TENANT_ID",
        "GRAPH_CLIENT_ID",
        "GRAPH_CLIENT_SECRET",
        "ONEDRIVE_DRIVE_ID",
        "ONEDRIVE_ROOT_ID",
      ],
    },
    {
      key: "notion",
      name: "Notion · controladoria e atas",
      description:
        "Importa tarefas por page ID, preservando registros existentes. Atas usam banco opcional.",
      vars: ["NOTION_TOKEN", "NOTION_DATABASE_ID"],
    },
    {
      key: "outbox",
      name: "Notion · fila de tarefas aprovadas",
      description:
        "Criação apenas após validação humana; reconciliação por JDA ID antes de cada envio.",
      vars: ["NOTION_TOKEN", "NOTION_DATABASE_ID"],
    },
  ];
  const unlinked = [
    ...docs.map((d) => ({ id: d.id, name: d.name, kind: "document" })),
    ...meetings.map((m) => ({ id: m.id, name: m.title, kind: "meeting" })),
    ...tasks.map((t) => ({ id: t.id, name: t.title, kind: "task" })),
  ];
  return (
    <Shell>
      <PageHeading
        eyebrow="FONTES E AUTOMAÇÃO"
        title="Integrações"
        description="Configuração no servidor, execução controlada e falhas visíveis."
      />
      <div className="legal-notice">
        <p>
          {user.isDemo
            ? "Modo demonstração: nenhum serviço externo é consultado ou modificado."
            : "Credenciais e IDs são configurados no servidor; esta página mostra somente presença e estado."}{" "}
          Escrita externa:{" "}
          <strong>
            {externalWritesAllowed()
              ? "habilitada para tarefas aprovadas"
              : "desativada"}
          </strong>
          .
        </p>
      </div>
      <div className="integration-grid">
        {configs.map((c) => {
          const state = states.find((s) => s.key === c.key),
            ready = c.vars.every((v) => !!process.env[v]);
          return (
            <Panel key={c.key} title={c.name} caption={c.description}>
              <Badge
                value={
                  user.isDemo
                    ? "Demo · desconectado"
                    : ready
                      ? "Configurado · não implica validação"
                      : "Configuração pendente"
                }
              />
              <ul className="config-list">
                {c.vars.map((v) => (
                  <li key={v}>
                    <code>{v}</code>
                    <span>{process.env[v] ? "presente" : "ausente"}</span>
                  </li>
                ))}
              </ul>
              <p className="muted">
                Última execução bem-sucedida: {date(state?.lastSuccessAt)}
              </p>
              {state?.lastError && (
                <p className="error-message" role="alert">
                  {state.lastError}
                </p>
              )}
              <form action={runSync}>
                <input type="hidden" name="target" value={c.key} />
                <button
                  disabled={
                    user.isDemo ||
                    !ready ||
                    (c.key === "outbox" && !externalWritesAllowed())
                  }
                >
                  Executar {c.key === "outbox" ? "fila" : "leitura"}
                </button>
              </form>
            </Panel>
          );
        })}
      </div>
      <Panel
        title="Fila de envio ao Notion"
        caption="Até 100 tarefas aprovadas · retries com backoff"
      >
        {jobs.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tarefa</th>
                  <th>Estado</th>
                  <th>Tentativas</th>
                  <th>Próxima tentativa</th>
                  <th>Falha</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id}>
                    <td>{j.task.title}</td>
                    <td>
                      <Badge value={j.status} />
                      {user.isDemo && <small> bloqueada em demo</small>}
                    </td>
                    <td>{j.attempts}</td>
                    <td>{date(j.nextAttemptAt)}</td>
                    <td>{j.lastError ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty text="Nenhuma tarefa aprovada na fila." />
        )}
      </Panel>
      <Panel
        title="Registros aguardando vínculo"
        caption="Documentos, atas e tarefas importadas · confirmar cliente manualmente"
      >
        {unlinked.length ? (
          unlinked.map((r) => (
            <form
              action={linkImported}
              className="link-row"
              key={`${r.kind}-${r.id}`}
            >
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="kind" value={r.kind} />
              <span>
                <strong>{r.name}</strong>
                <small>
                  {r.kind === "document"
                    ? "Documento / pasta"
                    : r.kind === "meeting"
                      ? "Ata"
                      : "Tarefa"}
                </small>
              </span>
              <select
                name="clientId"
                aria-label={`Cliente de ${r.name}`}
                required
              >
                <option value="">Selecione o cliente</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button>Confirmar vínculo</button>
            </form>
          ))
        ) : (
          <Empty text="Nenhum registro aguardando vínculo." />
        )}
      </Panel>
      <Panel
        title="Edições locais de tarefas importadas"
        caption="Não sobrescrevemos alterações locais com dados do Notion"
      >
        {conflicts.length ? (
          conflicts.map((t) => (
            <form action={acceptNotionSource} className="link-row" key={t.id}>
              <input type="hidden" name="id" value={t.id} />
              <span>
                <strong>{t.title}</strong>
                <small>
                  {t.syncConflict ??
                    "Edição local preservada; não enviada ao Notion."}
                </small>
              </span>
              <button>Aceitar fonte na próxima leitura</button>
            </form>
          ))
        ) : (
          <Empty text="Nenhum conflito ou edição local pendente." />
        )}
      </Panel>
      <p className="muted">
        Consulte docs/INTEGRACOES.md para permissões, mapeamento e homologação.
        Não insira credenciais em comentários, chat ou código.
      </p>
    </Shell>
  );
}
