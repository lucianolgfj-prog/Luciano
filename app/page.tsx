import Link from "next/link";
import {
  UsersRound,
  TrendingUp,
  CheckSquare,
  Scale,
  ArrowUpRight,
  ArrowRight,
} from "lucide-react";
import { actor } from "@/lib/auth";
import { db } from "@/lib/db";
import { money, date } from "@/lib/format";
import { dateInput } from "@/lib/format";
import { DashboardRefresh } from "@/components/refresh";
import { permissions } from "@/lib/policy";
import { Shell } from "@/components/shell";
import { Panel, Badge, Empty, PageHeading } from "@/components/ui";
export const dynamic = "force-dynamic";
export default async function Dashboard() {
  const user = await actor(),
    now = new Date();
  const scope = { isDemo: user.isDemo };
  const [year, month] = dateInput(now).split("-").map(Number);
  const periods = Array.from({ length: 6 }, (_, i) =>
    i === 5 ? now : new Date(Date.UTC(year, month - 1 - 5 + i + 1, 1, 3) - 1),
  );
  const [
    active,
    clients,
    mrrs,
    proposals,
    mine,
    pubs,
    people,
    groups,
    late,
    distribution,
  ] = await Promise.all([
    db.client.count({ where: { ...scope, active: true } }),
    db.client.findMany({ where: scope, orderBy: { name: "asc" }, take: 5 }),
    permissions.finance(user.role)
      ? Promise.all(
          periods.map((at) =>
            db.service.aggregate({
              where: {
                client: scope,
                startsAt: { lte: at },
                OR: [{ endsAt: null }, { endsAt: { gt: at } }],
              },
              _sum: { monthlyFee: true },
            }),
          ),
        )
      : Promise.resolve([]),
    permissions.finance(user.role)
      ? db.proposal.groupBy({
          by: ["stage"],
          where: { client: scope },
          _sum: { value: true },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    db.task.findMany({
      where: {
        ...scope,
        status: { not: "DONE" },
        ...(user.role === "ADMIN" ? {} : { assigneeId: user.id }),
      },
      include: { assignee: true, client: true },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      take: 4,
    }),
    permissions.publications(user.role)
      ? db.publication.count({ where: { ...scope, status: "PENDING" } })
      : Promise.resolve(0),
    db.user.findMany({
      where: { ...scope, active: true },
      orderBy: { name: "asc" },
    }),
    db.task.groupBy({ by: ["status"], where: scope, _count: { _all: true } }),
    db.task.count({
      where: { ...scope, status: { not: "DONE" }, dueAt: { lt: now } },
    }),
    db.task.groupBy({
      by: ["assigneeId"],
      where: { ...scope, status: { not: "DONE" } },
      _count: { _all: true },
    }),
  ]);
  const mrr = Number(mrrs[5]?._sum.monthlyFee ?? 0),
    done = groups.find((g) => g.status === "DONE")?._count._all ?? 0,
    pending = groups
      .filter((g) => g.status !== "DONE")
      .reduce((n, g) => n + g._count._all, 0);
  const months = periods.map((at, i) => ({
    label: new Intl.DateTimeFormat("pt-BR", {
      month: "short",
      timeZone: "America/Sao_Paulo",
    }).format(at),
    value: Number(mrrs[i]?._sum.monthlyFee ?? 0),
  }));
  const max = Math.max(1, ...months.map((m) => m.value));
  const pipeline = ["LEAD", "MEETING", "PROPOSAL", "WON", "LOST"];
  const won = proposals.find((p) => p.stage === "WON")?._count._all ?? 0,
    lost = proposals.find((p) => p.stage === "LOST")?._count._all ?? 0;
  const rate = won + lost ? Math.round((won / (won + lost)) * 100) : 0;
  return (
    <Shell>
      <PageHeading
        eyebrow="PAINEL DO ESCRITÓRIO"
        title={`Olá, ${user.name}.`}
        description="Sua operação, acompanhada de perto."
      >
        <span className="date-chip">{date(now)}</span>
      </PageHeading>
      <DashboardRefresh />
      <div className="metric-grid">
        <div className="metric-card">
          <div>
            <span>Clientes ativos</span>
            <UsersRound size={19} />
          </div>
          <strong>{active}</strong>
          <small>Carteira com cadastro ativo</small>
        </div>
        {permissions.finance(user.role) && (
          <div className="metric-card">
            <div>
              <span>Receita recorrente mensal</span>
              <TrendingUp size={19} />
            </div>
            <strong>{money(mrr)}</strong>
            <small>Honorários contratuais vigentes</small>
          </div>
        )}
        <div className="metric-card">
          <div>
            <span>Tarefas pendentes</span>
            <CheckSquare size={19} />
          </div>
          <strong>
            {pending}
            <em>{late} atrasadas</em>
          </strong>
          <small>{done} concluídas na base</small>
        </div>
        {permissions.publications(user.role) && (
          <div className="metric-card">
            <div>
              <span>Publicações para análise</span>
              <Scale size={19} />
            </div>
            <strong>{pubs}</strong>
            <small>Aguardando validação de Luciano</small>
          </div>
        )}
      </div>
      <div className="dashboard-two">
        {permissions.finance(user.role) && (
          <Panel
            title="Evolução da receita recorrente"
            caption="Vigência dos contratos · últimos 6 meses"
          >
            <div className="chart-top">
              <strong>{money(mrr)}</strong>
              <span>MRR atual · não representa recebimentos</span>
            </div>
            <div
              className="bar-chart"
              role="img"
              aria-label={months
                .map((m) => `${m.label}: ${money(m.value)}`)
                .join("; ")}
            >
              {months.map((m, i) => (
                <div className="bar-col" key={i}>
                  <small>{money(m.value)}</small>
                  <div
                    className={`bar ${i === 5 ? "current" : ""}`}
                    style={{
                      height: `${Math.max(2, (m.value / max) * 145)}px`,
                    }}
                  />
                  <span>{m.label}</span>
                </div>
              ))}
            </div>
          </Panel>
        )}
        <Panel
          title="Agenda da controladoria"
          caption={
            user.role === "ADMIN"
              ? "Prioridades de toda a equipe"
              : "Suas próximas tarefas"
          }
          href="/controladoria"
        >
          <div className="task-preview">
            {mine.length ? (
              mine.map((t) => (
                <Link key={t.id} href="/controladoria" className="task-row">
                  <div
                    className={`task-dot ${t.dueAt && t.dueAt < now ? "red" : ""}`}
                  />
                  <div>
                    <strong>{t.title}</strong>
                    <span>
                      {t.client?.name ?? "Sem cliente vinculado"} ·{" "}
                      {t.assignee.name}
                    </span>
                  </div>
                  <div>
                    <Badge value={t.status} late={!!t.dueAt && t.dueAt < now} />
                    <small>{date(t.dueAt)}</small>
                  </div>
                </Link>
              ))
            ) : (
              <Empty text="Nenhuma tarefa pendente neste perfil." />
            )}
          </div>
          <div className="panel-summary">
            <span>{late} tarefas atrasadas na equipe</span>
            <Link href="/controladoria">
              Abrir controladoria <ArrowRight size={15} />
            </Link>
          </div>
        </Panel>
      </div>
      <div className="dashboard-three">
        {permissions.finance(user.role) && (
          <Panel
            title="Pipeline comercial"
            caption={`Conversão: ${rate}% das propostas encerradas`}
            href="/comercial"
          >
            <div className="pipeline-mini">
              {pipeline.map((s, i) => {
                const p = proposals.find((p) => p.stage === s);
                return (
                  <div key={s}>
                    <span>
                      <i className={`stage-dot stage-${i}`} />
                      {
                        [
                          "Leads",
                          "Reuniões",
                          "Propostas",
                          "Ganhas",
                          "Perdidas",
                        ][i]
                      }
                    </span>
                    <strong>{p?._count._all ?? 0}</strong>
                    <small>{money(Number(p?._sum.value ?? 0))}</small>
                  </div>
                );
              })}
            </div>
          </Panel>
        )}
        <Panel
          title="Distribuição de tarefas"
          caption="Tarefas abertas por responsável"
        >
          <div className="distribution">
            {people.map((p) => {
              const total =
                distribution.find((g) => g.assigneeId === p.id)?._count._all ??
                0;
              return (
                <div key={p.id}>
                  <div>
                    <span className="avatar">{p.name[0]}</span>
                    <strong>{p.name}</strong>
                    <span>{total}</span>
                  </div>
                  <div className="progress">
                    <span
                      style={{
                        width: `${pending ? (total / pending) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
        <Panel title="Caixa de revisão" caption="Controle humano em cada etapa">
          <div className="review-graphic">
            <Scale size={32} />
          </div>
          <h3>
            {permissions.publications(user.role)
              ? `${pubs} publicações aguardando análise`
              : "Execução com responsabilidade"}
          </h3>
          <p className="muted">
            Providências jurídicas exigem validação e conferência na fonte
            oficial.
          </p>
          <Link
            className="outline-link"
            href={
              permissions.publications(user.role)
                ? "/publicacoes"
                : "/controladoria"
            }
          >
            Abrir{" "}
            {permissions.publications(user.role) ? "publicações" : "tarefas"}{" "}
            <ArrowUpRight size={16} />
          </Link>
        </Panel>
      </div>
      <Panel
        title="Carteira de clientes"
        caption="Acesse o histórico completo de cada cliente"
        href="/clientes"
      >
        {clients.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Contato</th>
                  <th>Situação</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link className="client-name" href={`/clientes/${c.id}`}>
                        <span className="client-avatar" aria-hidden="true">
                          {c.name[0]}
                        </span>
                        {c.name}
                      </Link>
                    </td>
                    <td>{c.email || "Não informado"}</td>
                    <td>
                      <Badge value={c.active ? "Ativo" : "Inativo"} />
                    </td>
                    <td>
                      <Link
                        href={`/clientes/${c.id}`}
                        aria-label={`Abrir ${c.name}`}
                      >
                        <ArrowUpRight size={17} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty />
        )}
      </Panel>
    </Shell>
  );
}
