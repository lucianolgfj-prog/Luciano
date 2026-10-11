import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { db } from "../../lib/db";
if (process.env.APP_MODE !== "demo")
  throw new Error("E2E requer modo demo em banco de desenvolvimento.");
const suffix = randomUUID().slice(0, 8),
  name = `Cliente E2E ${suffix}`,
  publicationId = `e2e-pub-${suffix}`;
let clientId: string | undefined;
test.beforeAll(async () => {
  await db.publication.create({
    data: {
      id: publicationId,
      fingerprint: publicationId,
      sourceId: `E2E-${suffix}`,
      content: "Publicação exclusivamente sintética do teste de navegador.",
      nature: "Teste preliminar",
      suggestion: "Conferir a fonte oficial de teste antes de agir.",
      isDemo: true,
    },
  });
});
test.afterAll(async () => {
  await db.outbox.deleteMany({ where: { task: { publicationId } } });
  await db.task.deleteMany({ where: { publicationId } });
  await db.publication.delete({ where: { id: publicationId } });
  if (clientId) {
    await db.task.deleteMany({ where: { clientId } });
    await db.service.deleteMany({ where: { clientId } });
    await db.proposal.deleteMany({ where: { clientId } });
    await db.timelineEvent.deleteMany({ where: { clientId } });
    await db.client.delete({ where: { id: clientId } });
  }
  await db.auditLog.deleteMany({
    where: {
      OR: [
        { entityId: publicationId },
        ...(clientId ? [{ entityId: clientId }] : []),
      ],
    },
  });
  await db.$disconnect();
});
async function login(page: import("@playwright/test").Page, name: string) {
  await page.goto("/login");
  await page.getByRole("button", { name: new RegExp(name) }).click();
  await expect(
    page.getByRole("heading", { name: `Olá, ${name}.` }),
  ).toBeVisible();
}
test("Luciano cadastra cliente, registra honorários, aprova publicação e consulta auditoria", async ({
  page,
}) => {
  await login(page, "Luciano");
  await expect(
    page.getByText("Dados sintéticos · integrações reais desativadas"),
  ).toBeVisible();
  await page.screenshot({ path: "/tmp/jda-dashboard.png", fullPage: true });
  await page.getByRole("link", { name: "Clientes", exact: true }).click();
  await page.getByText("Cadastrar cliente", { exact: true }).click();
  await page.getByLabel("Nome / razão social").fill(name);
  await page.getByLabel("E-mail", { exact: true }).fill("e2e@example.test");
  await page
    .getByRole("button", { name: "Salvar cliente", exact: true })
    .click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  clientId = page.url().split("/").pop();
  await page.getByText("Adicionar serviço contratado", { exact: true }).click();
  await page.getByLabel("Serviço", { exact: true }).fill("Assessoria E2E");
  await page.getByLabel("Mensalidade (R$)").fill("200");
  await page.getByLabel("Início de vigência").fill("2026-01-01");
  await page
    .getByRole("button", { name: "Adicionar serviço", exact: true })
    .click();
  await expect(
    page.getByText("Assessoria E2E", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("link", { name: "Publicações", exact: true }).click();
  const publication = page
    .locator("article.publication")
    .filter({ hasText: `E2E-${suffix}` });
  await publication
    .getByLabel("Cliente (vínculo confirmado)")
    .selectOption(clientId!);
  await publication
    .getByLabel("Nota de revisão / fonte oficial conferida")
    .fill("Fonte sintética conferida para teste de aprovação.");
  await publication.getByLabel("Conferi o conteúdo na fonte oficial").check();
  await publication
    .getByRole("button", { name: "Aprovar e criar tarefa" })
    .click();
  await expect(
    publication.getByText("Aprovada", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Controladoria", exact: true }).click();
  const task = page.locator("article.task-card").filter({ hasText: name });
  await expect(
    task.getByText("envio bloqueado na demonstração", { exact: false }),
  ).toBeVisible();
  await task.getByRole("combobox").first().selectOption("DONE");
  await task.getByRole("button", { name: "Atualizar", exact: true }).click();
  await expect(
    task.getByText("Concluída", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("link", { name: "Auditoria", exact: true }).click();
  await expect(
    page.getByText("PUBLICATION_APPROVED", { exact: true }).first(),
  ).toBeVisible();
});
test("Rafael não acessa aprovação, integração ou tarefas jurídicas; cadastro persiste em nova sessão", async ({
  page,
}) => {
  await login(page, "Rafael");
  await expect(
    page.getByRole("link", { name: "Publicações", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Integrações", exact: true }),
  ).toHaveCount(0);
  await page.goto("/publicacoes");
  await expect(page).toHaveURL("/");
  await page.goto("/clientes");
  await page.getByLabel("Buscar por nome, e-mail ou documento").fill(name);
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
  await page.goto("/controladoria");
  await expect(
    page.getByText("Revisar documentação fiscal", { exact: true }),
  ).toHaveCount(0);
});
test("Gustavo executa suas tarefas e não vê honorários; layout móvel não transborda", async ({
  page,
}) => {
  await login(page, "Gustavo");
  await expect(
    page.getByText("Receita recorrente mensal", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Comercial", exact: true }),
  ).toHaveCount(0);
  await page.goto("/clientes/demo-client-0");
  await expect(
    page.getByText("Serviços e honorários", { exact: true }),
  ).toHaveCount(0);
  await page.goto("/controladoria");
  await expect(
    page.getByText("Revisar documentação fiscal", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Criar tarefa local" }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Olá, Gustavo." }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await page.screenshot({ path: "/tmp/jda-mobile.png", fullPage: true });
});
test("rotas exigem sessão; endpoint de saúde verifica PostgreSQL", async ({
  request,
  page,
}) => {
  const r = await request.get("/api/health");
  expect(r.status()).toBe(200);
  expect(await r.json()).toEqual({ status: "ok" });
  await page.goto("/clientes");
  await expect(page).toHaveURL("/login");
});
