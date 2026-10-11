import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
async function main() {
  if (process.env.APP_MODE !== "demo") {
    const specs = [
      ["LUCIANO_EMAIL", "Luciano", Role.ADMIN],
      ["RAFAEL_EMAIL", "Rafael", Role.COMMERCIAL],
      ["GUSTAVO_EMAIL", "Gustavo", Role.LEGAL],
    ] as const;
    const emails = specs.map(([key]) => process.env[key]?.toLowerCase());
    if (emails.some((e) => !e) || new Set(emails).size !== 3)
      throw new Error(
        "Configure três e-mails distintos da allowlist antes de provisionar usuários.",
      );
    for (const [key, name, role] of specs) {
      const email = process.env[key]!.toLowerCase();
      const prior = await db.user.findUnique({ where: { email } });
      if (prior?.isDemo)
        throw new Error(
          "Identidade de demonstração não pode ser provisionada em produção.",
        );
      await db.user.upsert({
        where: { email },
        create: { email, name, role },
        update: { name, role },
      });
    }
    console.log(
      "Identidades autorizadas provisionadas; nenhum cliente de demonstração criado.",
    );
    return;
  }
  const names = [
    ["Luciano", Role.ADMIN],
    ["Rafael", Role.COMMERCIAL],
    ["Gustavo", Role.LEGAL],
  ] as const;
  for (const [name, role] of names)
    await db.user.upsert({
      where: { id: `demo-${name.toLowerCase()}` },
      create: {
        id: `demo-${name.toLowerCase()}`,
        name,
        email: `${name.toLowerCase()}@demo.jda.test`,
        role,
        isDemo: true,
      },
      update: {},
    });
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1),
  );
  const clients = [
    "Aurora Comércio · fictício",
    "Horizonte Tecnologia · fictício",
    "Verde Campo Alimentos · fictício",
    "Atlas Logística · fictício",
  ];
  for (const [i, name] of clients.entries()) {
    const id = `demo-client-${i}`;
    await db.client.upsert({
      where: { id },
      create: {
        id,
        name,
        email: `cliente${i}@example.test`,
        phone: "(62) 0000-0000",
        notes:
          "Cadastro sintético para demonstração. Não corresponde a pessoa ou empresa real.",
        active: i !== 3,
        isDemo: true,
      },
      update: {},
    });
    await db.service.upsert({
      where: { id: `demo-service-${i}` },
      create: {
        id: `demo-service-${i}`,
        clientId: id,
        name: "Assessoria tributária mensal",
        monthlyFee: 1500 + i * 750,
        startsAt: new Date(
          Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1),
        ),
        endsAt:
          i === 3
            ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
            : null,
      },
      update: {},
    });
    await db.proposal.upsert({
      where: { id: `demo-proposal-${i}` },
      create: {
        id: `demo-proposal-${i}`,
        clientId: id,
        title: "Consultoria tributária",
        value: 8000 + i * 2500,
        stage:
          i === 0 ? "WON" : i === 1 ? "PROPOSAL" : i === 2 ? "MEETING" : "LOST",
      },
      update: {},
    });
    await db.timelineEvent.upsert({
      where: { id: `demo-event-${i}` },
      create: {
        id: `demo-event-${i}`,
        clientId: id,
        title: "Cadastro de demonstração criado",
      },
      update: {},
    });
    await db.task.upsert({
      where: { id: `demo-task-${i}` },
      create: {
        id: `demo-task-${i}`,
        clientId: id,
        title: [
          "Revisar documentação fiscal",
          "Preparar proposta de assessoria",
          "Conferir andamento administrativo",
          "Registrar reunião comercial",
        ][i],
        description:
          "Tarefa sintética. Conferir documentação com o responsável antes de qualquer providência.",
        assigneeId: i % 2 ? "demo-rafael" : "demo-gustavo",
        isDemo: true,
        status: i === 3 ? "DONE" : i === 2 ? "IN_PROGRESS" : "PENDING",
        dueAt: new Date(now.getTime() + (i - 1) * 86400000),
        completedAt: i === 3 ? now : null,
      },
      update: {},
    });
    await db.case.upsert({
      where: { id: `demo-case-${i}` },
      create: {
        id: `demo-case-${i}`,
        clientId: id,
        number: `DEMO-ADMIN-${i + 1}`,
        court: "Órgão demonstrativo",
        kind: "Administrativo",
        status: "Em acompanhamento",
      },
      update: {},
    });
  }
  await db.publication.upsert({
    where: { fingerprint: "demo-publication-1" },
    create: {
      id: "demo-publication-1",
      fingerprint: "demo-publication-1",
      sourceId: "DEMO-001",
      caseNumber: "DEMO-ADMIN-1",
      court: "Tribunal demonstrativo",
      publishedAt: now,
      content:
        "EXEMPLO FICTÍCIO: despacho solicitando conferência de documentos. Nenhuma publicação real é reproduzida.",
      nature: "Despacho — classificação preliminar",
      suggestion:
        "Conferir o inteiro teor na fonte oficial e avaliar os documentos solicitados. Não há prazo calculado.",
      clientId: "demo-client-0",
      isDemo: true,
    },
    update: {},
  });
  console.log("Demonstração carregada sem sobrescrever registros existentes.");
}
main().finally(() => db.$disconnect());
