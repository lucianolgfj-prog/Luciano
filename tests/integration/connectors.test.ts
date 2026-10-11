import { test, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../../lib/db";
import { synchronize } from "../../lib/sync";
if (!process.env.DATABASE_URL?.includes("/jda_test"))
  throw new Error("Banco jda_test obrigatório.");
const originalFetch = globalThis.fetch;
after(async () => {
  globalThis.fetch = originalFetch;
  await db.outbox.deleteMany({ where: { taskId: "connector-task" } });
  await db.task.deleteMany({
    where: { OR: [{ id: "connector-task" }, { notionPageId: "fake-page" }] },
  });
  await db.publication.deleteMany({ where: { id: "connector-pub" } });
  await db.user.deleteMany({ where: { id: "connector-legal" } });
  await db.auditLog.deleteMany({
    where: { entityId: { in: ["notion", "outbox"] } },
  });
  await db.syncState.deleteMany({
    where: { key: { in: ["notion", "outbox"] } },
  });
  await db.$disconnect();
});
test("Notion importa sem duplicar, sincroniza fonte e preserva conflito local; fila bloqueada antes da flag", async () => {
  process.env.APP_MODE = "production";
  process.env.NOTION_TOKEN = "fake-not-a-secret";
  process.env.NOTION_DATABASE_ID = "fake-database";
  let status = "Não iniciada",
    edited = "2026-10-10T10:00:00Z",
    writes = 0;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    assert.ok(url.startsWith("https://api.notion.com/v1/"));
    if (url.endsWith("/pages")) {
      writes++;
      return Response.json({ id: "fake-sent-page" });
    }
    if (url.endsWith("/fake-database"))
      return Response.json({
        properties: {
          Nome: { type: "title" },
          Status: { type: "status" },
          "JDA ID": { type: "rich_text" },
        },
      });
    const body = JSON.parse(String(init?.body));
    if (body.filter) return Response.json({ results: [], has_more: false });
    return Response.json({
      has_more: false,
      results: [
        {
          id: "fake-page",
          url: "https://www.notion.so/fake-page",
          created_time: edited,
          last_edited_time: edited,
          properties: {
            Nome: {
              type: "title",
              title: [{ plain_text: "Tarefa importada de teste" }],
            },
            Status: { type: "status", status: { name: status } },
            "JDA ID": { type: "rich_text", rich_text: [] },
          },
        },
      ],
    });
  };
  await db.user.create({
    data: {
      id: "connector-legal",
      name: "Jurídico conector teste",
      email: "connector-legal@example.test",
      role: "LEGAL",
    },
  });
  assert.equal((await synchronize("notion", "connector")).ok, true);
  assert.equal((await synchronize("notion", "connector")).ok, true);
  assert.equal(
    await db.task.count({ where: { notionPageId: "fake-page" } }),
    1,
  );
  let imported = await db.task.findUniqueOrThrow({
    where: { notionPageId: "fake-page" },
  });
  assert.equal(imported.status, "PENDING");
  status = "Concluída";
  edited = "2026-10-11T10:00:00Z";
  await synchronize("notion", "connector");
  imported = await db.task.findUniqueOrThrow({
    where: { notionPageId: "fake-page" },
  });
  assert.equal(imported.status, "DONE");
  await db.task.update({
    where: { id: imported.id },
    data: { localDirty: true, status: "IN_PROGRESS" },
  });
  edited = "2026-10-12T10:00:00Z";
  await synchronize("notion", "connector");
  imported = await db.task.findUniqueOrThrow({
    where: { notionPageId: "fake-page" },
  });
  assert.equal(imported.status, "IN_PROGRESS");
  assert.ok(imported.syncConflict);
  await db.publication.create({
    data: {
      id: "connector-pub",
      fingerprint: "connector-pub",
      sourceId: "synthetic",
      content: "Teste",
      nature: "Teste",
      suggestion: "Conferir fonte oficial",
      status: "APPROVED",
    },
  });
  await db.task.create({
    data: {
      id: "connector-task",
      title: "Teste aprovado",
      description: "Teste",
      assigneeId: "connector-legal",
      publicationId: "connector-pub",
    },
  });
  await db.outbox.create({ data: { taskId: "connector-task" } });
  process.env.ALLOW_EXTERNAL_WRITES = "false";
  assert.equal((await synchronize("outbox", "connector")).ok, false);
  assert.equal(writes, 0);
  process.env.ALLOW_EXTERNAL_WRITES = "true";
  assert.equal((await synchronize("outbox", "connector")).ok, true);
  assert.equal(writes, 1);
  assert.equal(
    (await db.outbox.findUniqueOrThrow({ where: { taskId: "connector-task" } }))
      .status,
    "SENT",
  );
  await synchronize("outbox", "connector");
  assert.equal(writes, 1);
});
test("falha do provedor registra erro sem copiar corpo sigiloso", async () => {
  globalThis.fetch = async () =>
    new Response("token=CONFIDENTIAL", { status: 403 });
  assert.equal((await synchronize("notion", "connector")).ok, false);
  const s = await db.syncState.findUniqueOrThrow({ where: { key: "notion" } });
  assert.match(s.lastError ?? "", /403/);
  assert.doesNotMatch(s.lastError ?? "", /CONFIDENTIAL/);
});
