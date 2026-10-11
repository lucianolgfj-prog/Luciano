import { test, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../../lib/db";
import { changeTask, reviewPublication } from "../../lib/workflow";
if (!process.env.DATABASE_URL?.includes("/jda_test"))
  throw new Error("Testes de integração exigem banco exclusivo jda_test.");
after(async () => {
  await db.outbox.deleteMany({
    where: {
      task: { publicationId: { in: ["test-publication", "test-reject"] } },
    },
  });
  await db.task.deleteMany({
    where: { publicationId: { in: ["test-publication", "test-reject"] } },
  });
  await db.publication.deleteMany({
    where: { id: { in: ["test-publication", "test-reject"] } },
  });
  await db.auditLog.deleteMany({
    where: { actorId: { in: ["test-admin", "test-legal"] } },
  });
  await db.user.deleteMany({
    where: { id: { in: ["test-admin", "test-legal"] } },
  });
  await db.$disconnect();
});
test("aprovação concorrente gera uma única tarefa, outbox e auditoria", async () => {
  const admin = await db.user.create({
    data: {
      id: "test-admin",
      name: "Luciano teste",
      email: "test-admin@example.test",
      role: "ADMIN",
      isDemo: true,
    },
  });
  const legal = await db.user.create({
    data: {
      id: "test-legal",
      name: "Gustavo teste",
      email: "test-legal@example.test",
      role: "LEGAL",
      isDemo: true,
    },
  });
  const p = await db.publication.create({
    data: {
      id: "test-publication",
      fingerprint: "test-fingerprint",
      sourceId: "synthetic",
      content: "Teste",
      nature: "Despacho",
      suggestion: "Conferir fonte oficial",
      isDemo: true,
    },
  });
  const input = {
    id: p.id,
    decision: "APPROVED" as const,
    assigneeId: legal.id,
    suggestion: "Conferir a fonte oficial e o conteúdo.",
    note: "Fonte sintética conferida.",
  };
  const results = await Promise.allSettled([
    reviewPublication(admin, input),
    reviewPublication(admin, input),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(await db.task.count({ where: { publicationId: p.id } }), 1);
  assert.equal(
    await db.outbox.count({ where: { task: { publicationId: p.id } } }),
    1,
  );
  assert.equal(
    await db.auditLog.count({
      where: { entityId: p.id, action: "PUBLICATION_APPROVED" },
    }),
    1,
  );
  const task = await db.task.findUniqueOrThrow({
    where: { publicationId: p.id },
  });
  assert.equal(task.dueAt, null);
  await assert.rejects(
    changeTask({ ...legal, id: "another-user" }, task.id, "DONE"),
  );
  await changeTask(legal, task.id, "DONE");
  assert.equal(
    (await db.task.findUniqueOrThrow({ where: { id: task.id } })).status,
    "DONE",
  );
  await assert.rejects(reviewPublication(legal, input), /Apenas Luciano/);
  await assert.rejects(
    changeTask({ ...admin, isDemo: false }, task.id, "PENDING"),
  );
  await assert.rejects(reviewPublication(admin, input), /já foi revisada/);
});
test("descarte não cria tarefa nem fila", async () => {
  const admin = await db.user.findUniqueOrThrow({
    where: { id: "test-admin" },
  });
  const p = await db.publication.create({
    data: {
      id: "test-reject",
      fingerprint: "reject-test",
      sourceId: "test",
      content: "Teste",
      nature: "Não identificada",
      suggestion: "Conferir fonte oficial",
      isDemo: true,
    },
  });
  await reviewPublication(admin, {
    id: p.id,
    decision: "REJECTED",
    assigneeId: "test-legal",
    suggestion: "Publicação não relacionada.",
    note: "Conferência realizada.",
  });
  assert.equal(await db.task.count({ where: { publicationId: p.id } }), 0);
  assert.equal(
    (await db.publication.findUniqueOrThrow({ where: { id: p.id } })).status,
    "REJECTED",
  );
});
