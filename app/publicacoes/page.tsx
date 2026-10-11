import { redirect } from "next/navigation";
import { Scale, ExternalLink } from "lucide-react";
import { actor } from "@/lib/auth";
import { db } from "@/lib/db";
import { permissions } from "@/lib/policy";
import { date, safeLink } from "@/lib/format";
import { decidePublication } from "@/app/actions";
import { Shell } from "@/components/shell";
import { Panel, Badge, Empty, PageHeading, Field } from "@/components/ui";
export default async function Publications() {
  const user = await actor();
  if (!permissions.publications(user.role)) redirect("/");
  const [pubs, clients, people] = await Promise.all([
    db.publication.findMany({
      where: { isDemo: user.isDemo },
      include: { task: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.client.findMany({
      where: { isDemo: user.isDemo },
      orderBy: { name: "asc" },
    }),
    db.user.findMany({
      where: { isDemo: user.isDemo, active: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return (
    <Shell>
      <PageHeading
        eyebrow="TRIAGEM E VALIDAÇÃO"
        title="Publicações judiciais"
        description="Sugestões preliminares, decisão humana e rastreabilidade."
      />
      <div className="legal-notice">
        <Scale size={21} />
        <p>
          Confira o inteiro teor na fonte oficial. A classificação é preliminar
          e não calcula prazos processuais. Apenas Luciano pode aprovar o
          registro de uma tarefa.
        </p>
      </div>
      <Panel
        title="Caixa de revisão"
        caption="Últimas 100 publicações · duplicidades verificadas pelo identificador da fonte e conteúdo"
      >
        {pubs.length ? (
          <div className="publications">
            {pubs.map((p) => (
              <article className="publication" key={p.id}>
                <div className="publication-top">
                  <span className="source-tag">{p.sourceId}</span>
                  <Badge value={p.status} />
                </div>
                <h3>{p.caseNumber ?? "Número processual não identificado"}</h3>
                <div className="publication-meta">
                  <span>{p.court ?? "Tribunal não identificado"}</span>
                  <span>Publicação: {date(p.publishedAt)}</span>
                </div>
                <h4>Conteúdo recebido</h4>
                <pre className="publication-content">{p.content}</pre>
                {p.sourceUrl && safeLink(p.sourceUrl) && (
                  <a
                    className="text-link"
                    href={safeLink(p.sourceUrl)!}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Abrir mensagem original <ExternalLink size={14} />
                  </a>
                )}
                <div className="suggestion">
                  <span>ANÁLISE PRELIMINAR · REGRAS LOCAIS</span>
                  <strong>{p.nature}</strong>
                  <p>{p.suggestion}</p>
                </div>
                {p.status === "PENDING" && user.role === "ADMIN" ? (
                  <form action={decidePublication} className="form-grid">
                    <input type="hidden" name="id" value={p.id} />
                    <Field label="Cliente (vínculo confirmado)">
                      <select name="clientId" defaultValue={p.clientId ?? ""}>
                        <option value="">Sem vínculo confirmado</option>
                        {clients.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Responsável">
                      <select
                        name="assigneeId"
                        defaultValue={
                          people.find((u) => u.role === "LEGAL")?.id
                        }
                      >
                        {people.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <label className="field full">
                      <span>Descrição da tarefa — revise antes de aprovar</span>
                      <textarea
                        name="suggestion"
                        defaultValue={p.suggestion}
                        minLength={10}
                        maxLength={5000}
                        required
                      />
                    </label>
                    <label className="field full">
                      <span>Nota de revisão / fonte oficial conferida</span>
                      <textarea
                        name="note"
                        placeholder="Registre a fonte consultada e sua decisão."
                        minLength={3}
                        maxLength={2000}
                        required
                      />
                    </label>
                    <label className="check-field full">
                      <input type="checkbox" name="officialChecked" />
                      Conferi o conteúdo na fonte oficial; eventuais prazos
                      serão avaliados separadamente.
                    </label>
                    <div className="form-end">
                      <button
                        className="primary"
                        name="decision"
                        value="APPROVED"
                      >
                        Aprovar e criar tarefa
                      </button>
                      <button name="decision" value="REJECTED">
                        Descartar sugestão
                      </button>
                      <small>
                        {user.isDemo
                          ? "Notion bloqueado na demonstração."
                          : "A tarefa entra na fila; envio depende de escrita externa autorizada."}
                      </small>
                    </div>
                  </form>
                ) : (
                  <p className="muted">
                    {p.status === "PENDING"
                      ? "Aguardando validação de Luciano."
                      : `Revisada em ${date(p.reviewedAt)} · ${p.reviewNote ?? ""}${p.task ? " · Tarefa local criada." : ""}`}
                  </p>
                )}
              </article>
            ))}
          </div>
        ) : (
          <Empty text="Nenhuma publicação importada. Configure o Outlook ou use a demonstração." />
        )}
      </Panel>
    </Shell>
  );
}
