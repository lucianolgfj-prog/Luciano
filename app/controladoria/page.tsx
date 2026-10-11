import { actor } from "@/lib/auth";
import { db } from "@/lib/db";
import { date, dateInput } from "@/lib/format";
import { createTask, setTaskStatus, assignTask } from "@/app/actions";
import { Shell } from "@/components/shell";
import { Badge, Panel, Empty, PageHeading, Field } from "@/components/ui";
export default async function Tasks({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await actor(),
    { status } = await searchParams;
  const [tasks, clients, people] = await Promise.all([
    db.task.findMany({
      where: {
        isDemo: user.isDemo,
        ...(user.role !== "ADMIN" ? { assigneeId: user.id } : {}),
        ...(status === "late"
          ? { status: { not: "DONE" }, dueAt: { lt: new Date() } }
          : status === "done"
            ? { status: "DONE" }
            : status === "open"
              ? { status: { not: "DONE" } }
              : {}),
      },
      include: { client: true, assignee: true, outbox: true },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      take: 200,
    }),
    db.client.findMany({
      where: { isDemo: user.isDemo },
      orderBy: { name: "asc" },
    }),
    db.user.findMany({ where: { isDemo: user.isDemo, active: true } }),
  ]);
  return (
    <Shell>
      <PageHeading
        eyebrow="OPERAÇÃO JURÍDICA"
        title="Controladoria"
        description={
          user.role === "ADMIN"
            ? "Distribua o trabalho e acompanhe a execução da equipe."
            : "Acompanhe e atualize as tarefas atribuídas a você."
        }
      />
      <form className="filter-form">
        <label>
          Situação{" "}
          <select name="status" defaultValue={status ?? ""}>
            <option value="">Todas</option>
            <option value="open">Abertas</option>
            <option value="late">Atrasadas</option>
            <option value="done">Concluídas</option>
          </select>
        </label>
        <button>Filtrar</button>
        <small>Até 200 tarefas por filtro · prazo cadastrado manualmente</small>
      </form>
      <Panel
        title={user.role === "ADMIN" ? "Tarefas da equipe" : "Minhas tarefas"}
        caption={`${tasks.length} tarefas exibidas`}
      >
        {tasks.length ? (
          <div className="task-cards">
            {tasks.map((t) => (
              <article className="task-card" key={t.id}>
                <div className="task-card-top">
                  <Badge
                    value={t.status}
                    late={
                      t.status !== "DONE" && !!t.dueAt && t.dueAt < new Date()
                    }
                  />
                  <span>{t.assignee.name}</span>
                </div>
                <h3>{t.title}</h3>
                <p>{t.description}</p>
                <div className="task-meta">
                  <span>{t.client?.name ?? "Sem cliente vinculado"}</span>
                  <span>Data: {date(t.dueAt)}</span>
                </div>
                {t.publicationId && (
                  <p className="muted">
                    Publicação validada · Notion:{" "}
                    {t.outbox?.status === "SENT"
                      ? "enviada"
                      : user.isDemo
                        ? "envio bloqueado na demonstração"
                        : t.outbox?.status === "FAILED"
                          ? "falha de envio"
                          : "aguardando envio autorizado"}
                  </p>
                )}
                {t.source === "NOTION" && (
                  <p className="muted">
                    Fonte: Notion · alterações locais não são enviadas ao
                    provedor.{t.localDirty && " Edição local preservada."}
                  </p>
                )}
                {t.syncConflict && (
                  <p className="error-message">{t.syncConflict}</p>
                )}
                <form action={setTaskStatus} className="inline-form">
                  <input type="hidden" name="id" value={t.id} />
                  <select
                    name="status"
                    aria-label={`Situação de ${t.title}`}
                    defaultValue={t.status}
                  >
                    <option value="PENDING">Pendente</option>
                    <option value="IN_PROGRESS">Em andamento</option>
                    <option value="DONE">Concluída</option>
                  </select>
                  <button>Atualizar</button>
                </form>
                {user.role === "ADMIN" && (
                  <details>
                    <summary>Distribuir e conferir data</summary>
                    <form action={assignTask} className="form-grid">
                      <input type="hidden" name="id" value={t.id} />
                      <Field label="Responsável">
                        <select name="assigneeId" defaultValue={t.assigneeId}>
                          {people.map((p) => (
                            <option value={p.id} key={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Data conferida (opcional)">
                        <input
                          type="date"
                          name="dueAt"
                          defaultValue={dateInput(t.dueAt)}
                        />
                      </Field>
                      <button>Salvar distribuição</button>
                    </form>
                  </details>
                )}
              </article>
            ))}
          </div>
        ) : (
          <Empty />
        )}
      </Panel>
      {user.role === "ADMIN" && (
        <details className="form-panel">
          <summary>Nova tarefa</summary>
          <form action={createTask} className="form-grid">
            <Field label="Título">
              <input name="title" required minLength={3} maxLength={200} />
            </Field>
            <Field label="Cliente">
              <select name="clientId">
                <option value="">Sem vínculo</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Responsável">
              <select name="assigneeId">
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Data conferida manualmente (opcional)">
              <input type="date" name="dueAt" />
            </Field>
            <Field label="Descrição">
              <textarea
                name="description"
                required
                minLength={3}
                maxLength={5000}
              />
            </Field>
            <div className="form-end">
              <button className="primary">Criar tarefa local</button>
              <small>
                Tarefas manuais não são enviadas ao Notion automaticamente.
              </small>
            </div>
          </form>
        </details>
      )}
    </Shell>
  );
}
