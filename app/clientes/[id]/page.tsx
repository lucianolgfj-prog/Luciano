import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { actor } from "@/lib/auth";
import { db } from "@/lib/db";
import { permissions } from "@/lib/policy";
import { date, money, safeLink } from "@/lib/format";
import { saveClient, addService, endService, addCase } from "@/app/actions";
import { Shell } from "@/components/shell";
import { Badge, Panel, Empty, PageHeading, Field } from "@/components/ui";
export default async function ClientDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await actor(),
    { id } = await params;
  const c = await db.client.findFirst({
    where: { id, isDemo: user.isDemo },
    include: {
      proposals: { orderBy: { createdAt: "desc" } },
      services: { orderBy: { startsAt: "desc" } },
      tasks: {
        where: user.role === "ADMIN" ? {} : { assigneeId: user.id },
        include: { assignee: true },
        orderBy: { createdAt: "desc" },
      },
      cases: true,
      documents: true,
      meetings: { orderBy: { happenedAt: "desc" } },
      events: { orderBy: { createdAt: "desc" }, take: 100 },
    },
  });
  if (!c) notFound();
  return (
    <Shell>
      <Link href="/clientes" className="back-link">
        <ArrowLeft size={15} />
        Todos os clientes
      </Link>
      <PageHeading
        eyebrow="FICHA DO CLIENTE"
        title={c.name}
        description="Cadastro, serviços e histórico em um só lugar."
      >
        <Badge value={c.active ? "Ativo" : "Inativo"} />
      </PageHeading>
      <div className="detail-grid">
        <Panel title="Dados cadastrais">
          <dl>
            <dt>Documento</dt>
            <dd>{c.taxId || "Não informado"}</dd>
            <dt>E-mail</dt>
            <dd>{c.email || "Não informado"}</dd>
            <dt>Telefone</dt>
            <dd>{c.phone || "Não informado"}</dd>
            <dt>Cliente desde</dt>
            <dd>{date(c.createdAt)}</dd>
            {permissions.clients(user.role) && (
              <>
                <dt>Observações</dt>
                <dd>{c.notes || "Sem observações"}</dd>
              </>
            )}
          </dl>
        </Panel>
        <Panel
          title="Andamento dos serviços"
          caption="Tarefas visíveis para o seu perfil"
        >
          {c.tasks.length ? (
            c.tasks.map((t) => (
              <div className="list-item" key={t.id}>
                <div>
                  <strong>{t.title}</strong>
                  <p>
                    {t.assignee.name} · {date(t.dueAt)}
                  </p>
                </div>
                <Badge value={t.status} />
              </div>
            ))
          ) : (
            <Empty text="Nenhuma tarefa disponível neste perfil." />
          )}
          <Link className="text-link" href="/controladoria">
            Abrir controladoria <ExternalLink size={14} />
          </Link>
        </Panel>
      </div>
      {permissions.finance(user.role) && (
        <div className="detail-grid">
          <Panel
            title="Serviços e honorários"
            caption="Mensalidade contratual e vigência"
          >
            {c.services.length ? (
              c.services.map((s) => (
                <div className="service-item" key={s.id}>
                  <div className="list-item">
                    <div>
                      <strong>{s.name}</strong>
                      <p>
                        {date(s.startsAt)} →{" "}
                        {s.endsAt ? date(s.endsAt) : "Em vigor"}
                      </p>
                    </div>
                    <strong>{money(s.monthlyFee)}/mês</strong>
                  </div>
                  {user.role === "ADMIN" && !s.endsAt && (
                    <form action={endService} className="inline-form">
                      <input type="hidden" name="id" value={s.id} />
                      <label>
                        Encerrar vigência{" "}
                        <input type="date" name="endsAt" required />
                      </label>
                      <button>Registrar fim</button>
                    </form>
                  )}
                </div>
              ))
            ) : (
              <Empty />
            )}
            {user.role === "ADMIN" && (
              <details>
                <summary>Adicionar serviço contratado</summary>
                <form action={addService} className="form-grid">
                  <input type="hidden" name="clientId" value={id} />
                  <Field label="Serviço">
                    <input name="name" required minLength={3} />
                  </Field>
                  <Field label="Mensalidade (R$)">
                    <input
                      name="monthlyFee"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                    />
                  </Field>
                  <Field label="Início de vigência">
                    <input name="startsAt" type="date" required />
                  </Field>
                  <Field label="Fim (opcional)">
                    <input name="endsAt" type="date" />
                  </Field>
                  <button className="primary">Adicionar serviço</button>
                </form>
              </details>
            )}
          </Panel>
          <Panel title="Histórico comercial">
            {c.proposals.length ? (
              c.proposals.map((p) => (
                <div className="list-item" key={p.id}>
                  <div>
                    <strong>{p.title}</strong>
                    <p>
                      {money(p.value)} · {date(p.createdAt)}
                    </p>
                  </div>
                  <Badge value={p.stage} />
                </div>
              ))
            ) : (
              <Empty />
            )}
            <Link className="text-link" href="/comercial">
              Gerenciar propostas <ExternalLink size={14} />
            </Link>
          </Panel>
        </div>
      )}
      {user.role !== "COMMERCIAL" && (
        <Panel title="Processos judiciais e administrativos">
          {c.cases.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Número</th>
                    <th>Órgão / tribunal</th>
                    <th>Tipo</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {c.cases.map((p) => (
                    <tr key={p.id}>
                      <td>{p.number}</td>
                      <td>{p.court}</td>
                      <td>{p.kind}</td>
                      <td>{p.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty />
          )}
          <details>
            <summary>Vincular processo</summary>
            <form action={addCase} className="form-grid">
              <input type="hidden" name="clientId" value={id} />
              <Field label="Número">
                <input name="number" required minLength={3} />
              </Field>
              <Field label="Órgão / tribunal">
                <input name="court" required minLength={2} />
              </Field>
              <Field label="Tipo">
                <select name="kind">
                  <option>Judicial</option>
                  <option>Administrativo</option>
                </select>
              </Field>
              <Field label="Situação">
                <input name="status" required minLength={3} />
              </Field>
              <button className="primary">Vincular processo</button>
            </form>
          </details>
        </Panel>
      )}
      <div className="detail-grid">
        <Panel
          title="Contratos e documentos"
          caption="Acesso pelo OneDrive, sujeito às permissões da fonte"
        >
          {c.documents.length ? (
            c.documents.map((d) => (
              <div className="list-item" key={d.id}>
                <div>
                  <strong>{d.name}</strong>
                  <p>
                    {d.kind} · atualizado em {date(d.modifiedAt)}
                  </p>
                </div>
                {d.kind !== "REMOVIDO NA FONTE" && safeLink(d.url) && (
                  <a
                    href={safeLink(d.url)!}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Abrir <ExternalLink size={14} />
                  </a>
                )}
              </div>
            ))
          ) : (
            <Empty text="Nenhum documento vinculado. Configure a integração e confirme o vínculo." />
          )}
        </Panel>
        <Panel
          title="Atas de reuniões"
          caption="Registros vinculados do Notion"
        >
          {c.meetings.length ? (
            c.meetings.map((m) => (
              <div className="list-item" key={m.id}>
                <div>
                  <strong>{m.title}</strong>
                  <p>{date(m.happenedAt)}</p>
                </div>
                {safeLink(m.url) && (
                  <a
                    href={safeLink(m.url)!}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Abrir <ExternalLink size={14} />
                  </a>
                )}
              </div>
            ))
          ) : (
            <Empty text="Nenhuma ata vinculada." />
          )}
        </Panel>
      </div>
      <Panel
        title="Histórico de movimentações"
        caption="Últimos 100 eventos do cliente"
      >
        <ol className="timeline">
          {c.events.map((e) => (
            <li key={e.id}>
              <span />
              <div>
                <strong>{e.title}</strong>
                <small>{date(e.createdAt)}</small>
              </div>
            </li>
          ))}
        </ol>
        {!c.events.length && <Empty />}
      </Panel>
      {permissions.clients(user.role) && (
        <details className="form-panel">
          <summary>Editar cadastro</summary>
          <form action={saveClient} className="form-grid">
            <input type="hidden" name="id" value={id} />
            <Field label="Nome">
              <input
                name="name"
                defaultValue={c.name}
                minLength={3}
                maxLength={160}
                required
              />
            </Field>
            <Field label="CPF / CNPJ">
              <input name="taxId" defaultValue={c.taxId ?? ""} maxLength={30} />
            </Field>
            <Field label="E-mail">
              <input name="email" type="email" defaultValue={c.email ?? ""} />
            </Field>
            <Field label="Telefone">
              <input name="phone" defaultValue={c.phone ?? ""} maxLength={40} />
            </Field>
            <Field label="Situação">
              <select name="active" defaultValue={String(c.active)}>
                <option value="true">Ativo</option>
                <option value="false">Inativo</option>
              </select>
            </Field>
            <Field label="Observações">
              <textarea
                name="notes"
                defaultValue={c.notes ?? ""}
                maxLength={3000}
              />
            </Field>
            <div className="form-end">
              <button className="primary">Salvar alterações</button>
            </div>
          </form>
        </details>
      )}
    </Shell>
  );
}
