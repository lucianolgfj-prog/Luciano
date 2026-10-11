import Link from "next/link";
import { Search, Plus, ArrowUpRight } from "lucide-react";
import { actor } from "@/lib/auth";
import { db } from "@/lib/db";
import { permissions } from "@/lib/policy";
import { saveClient } from "@/app/actions";
import { Shell } from "@/components/shell";
import { Badge, Panel, Empty, PageHeading, Field } from "@/components/ui";
export default async function Clients({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await actor();
  const q = (await searchParams).q?.slice(0, 160) ?? "";
  const clients = await db.client.findMany({
    where: {
      isDemo: user.isDemo,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { taxId: { contains: q } },
            ],
          }
        : {}),
    },
    include: { _count: { select: { tasks: true, cases: true } } },
    orderBy: { name: "asc" },
    take: 200,
  });
  return (
    <Shell>
      <PageHeading
        eyebrow="RELACIONAMENTO"
        title="Clientes"
        description="Uma ficha única para toda a jornada do cliente."
      />
      <form className="search-form">
        <Search size={18} />
        <input
          name="q"
          aria-label="Buscar por nome, e-mail ou documento"
          defaultValue={q}
          placeholder="Buscar por nome, e-mail ou documento"
        />
        <button>Buscar</button>
      </form>
      <Panel
        title="Carteira do escritório"
        caption={`${clients.length} registros exibidos · até 200 por busca`}
      >
        {clients.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>E-mail</th>
                  <th>Situação</th>
                  <th>Tarefas</th>
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
                    <td>{c._count.tasks}</td>
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
          <Empty text="Nenhum cliente nesta busca." />
        )}
      </Panel>
      {permissions.clients(user.role) && (
        <details className="form-panel">
          <summary>
            <Plus size={18} />
            Cadastrar cliente
          </summary>
          <form action={saveClient} className="form-grid">
            <Field label="Nome / razão social">
              <input name="name" required minLength={3} maxLength={160} />
            </Field>
            <Field label="CPF / CNPJ">
              <input name="taxId" maxLength={30} />
            </Field>
            <Field label="E-mail">
              <input type="email" name="email" />
            </Field>
            <Field label="Telefone">
              <input name="phone" maxLength={40} />
            </Field>
            <Field label="Observações comerciais">
              <textarea name="notes" maxLength={3000} />
            </Field>
            <div className="form-end">
              <button className="primary">Salvar cliente</button>
            </div>
          </form>
        </details>
      )}
    </Shell>
  );
}
