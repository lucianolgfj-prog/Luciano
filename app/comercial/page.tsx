import { redirect } from "next/navigation";
import { actor } from "@/lib/auth";
import { db } from "@/lib/db";
import { permissions } from "@/lib/policy";
import { money, labels } from "@/lib/format";
import { conversion } from "@/lib/metrics";
import { saveProposal } from "@/app/actions";
import { Shell } from "@/components/shell";
import { Empty, PageHeading, Field } from "@/components/ui";
export default async function Commercial() {
  const user = await actor();
  if (!permissions.finance(user.role)) redirect("/");
  const [proposals, clients] = await Promise.all([
    db.proposal.findMany({
      where: { client: { isDemo: user.isDemo } },
      include: { client: true },
      orderBy: { updatedAt: "desc" },
      take: 500,
    }),
    db.client.findMany({
      where: { isDemo: user.isDemo },
      orderBy: { name: "asc" },
    }),
  ]);
  const stages = ["LEAD", "MEETING", "PROPOSAL", "WON", "LOST"] as const;
  return (
    <Shell>
      <PageHeading
        eyebrow="GESTÃO COMERCIAL"
        title="Pipeline e propostas"
        description="Da primeira conversa ao contrato, com histórico preservado."
      >
        <span className="date-chip">
          Conversão: {conversion(proposals.map((p) => p.stage))}%
        </span>
      </PageHeading>
      <p className="muted">
        Conversão = ganhas / propostas encerradas. Até 500 propostas recentes
        neste quadro.
      </p>
      <div className="kanban">
        {stages.map((s, i) => {
          const items = proposals.filter((p) => p.stage === s);
          return (
            <section className="kanban-column" key={s}>
              <header>
                <i className={`stage-dot stage-${i}`} />
                <h2>{labels[s]}</h2>
                <span>{items.length}</span>
              </header>
              <p>{money(items.reduce((n, p) => n + Number(p.value), 0))}</p>
              {items.length ? (
                items.map((p) => (
                  <article className="deal-card" key={p.id}>
                    <span>{p.client.name}</span>
                    <h3>{p.title}</h3>
                    <strong>{money(p.value)}</strong>
                    <form action={saveProposal}>
                      <input type="hidden" name="id" value={p.id} />
                      <select
                        name="stage"
                        aria-label={`Etapa de ${p.title}`}
                        defaultValue={p.stage}
                      >
                        {stages.map((s) => (
                          <option key={s} value={s}>
                            {labels[s]}
                          </option>
                        ))}
                      </select>
                      <button>Mover</button>
                    </form>
                  </article>
                ))
              ) : (
                <Empty text="Sem propostas" />
              )}
            </section>
          );
        })}
      </div>
      <details className="form-panel">
        <summary>Nova proposta</summary>
        <form action={saveProposal} className="form-grid">
          <Field label="Cliente">
            <select name="clientId" required>
              <option value="">Selecione</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Título">
            <input name="title" required minLength={3} />
          </Field>
          <Field label="Valor da proposta (R$)">
            <input type="number" step="0.01" min="0" name="value" required />
          </Field>
          <Field label="Etapa">
            <select name="stage">
              {stages.map((s) => (
                <option key={s} value={s}>
                  {labels[s]}
                </option>
              ))}
            </select>
          </Field>
          <div className="form-end">
            <button className="primary">Registrar proposta</button>
          </div>
        </form>
      </details>
    </Shell>
  );
}
