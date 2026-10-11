import { admin } from "@/lib/auth";
import { db } from "@/lib/db";
import { date } from "@/lib/format";
import { Shell } from "@/components/shell";
import { Panel, Empty, PageHeading } from "@/components/ui";
export default async function Audit() {
  const user = await admin();
  const [logs, users] = await Promise.all([
    db.auditLog.findMany({
      where: { isDemo: user.isDemo },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.user.findMany({ where: { isDemo: user.isDemo } }),
  ]);
  return (
    <Shell>
      <PageHeading
        eyebrow="GOVERNANÇA"
        title="Auditoria"
        description="Registro persistente das alterações e sincronizações."
      />
      <Panel
        title="Últimos eventos"
        caption="Até 200 eventos · sem tokens nem conteúdo integral de documentos"
      >
        {logs.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Responsável</th>
                  <th>Ação</th>
                  <th>Objeto</th>
                  <th>Detalhe</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td>
                      {date(l.createdAt)}
                      <small>
                        {l.createdAt.toLocaleTimeString("pt-BR", {
                          timeZone: "America/Sao_Paulo",
                        })}
                      </small>
                    </td>
                    <td>
                      {users.find((u) => u.id === l.actorId)?.name ?? l.actorId}
                    </td>
                    <td>
                      <code>{l.action}</code>
                    </td>
                    <td>{l.entityType}</td>
                    <td>{l.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty text="Os eventos aparecerão após a primeira alteração." />
        )}
      </Panel>
    </Shell>
  );
}
