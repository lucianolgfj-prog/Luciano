import { db } from "./db";
import { canUpdateTask } from "./policy";
import type { User, TaskStatus } from "@prisma/client";
export async function changeTask(actor: User, id: string, status: TaskStatus) {
  return db.$transaction(async (tx) => {
    const task = await tx.task.findUnique({ where: { id } });
    if (!task || task.isDemo !== actor.isDemo || !canUpdateTask(actor, task))
      throw new Error("Tarefa indisponível para este usuário.");
    await tx.task.update({
      where: { id },
      data: {
        status,
        completedAt: status === "DONE" ? new Date() : null,
        localDirty: task.source === "NOTION" ? true : task.localDirty,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "TASK_STATUS",
        entityType: "Task",
        entityId: id,
        detail: `${task.status} → ${status}`,
        isDemo: actor.isDemo,
      },
    });
    if (task.clientId)
      await tx.timelineEvent.create({
        data: {
          clientId: task.clientId,
          title: `Tarefa ${task.title}: ${status === "DONE" ? "concluída" : status === "IN_PROGRESS" ? "em andamento" : "pendente"}`,
        },
      });
  });
}
export async function reviewPublication(
  actor: User,
  input: {
    id: string;
    decision: "APPROVED" | "REJECTED";
    assigneeId: string;
    clientId?: string;
    suggestion: string;
    note: string;
  },
) {
  if (actor.role !== "ADMIN")
    throw new Error("Apenas Luciano pode validar publicações.");
  return db.$transaction(async (tx) => {
    const p = await tx.publication.findUnique({ where: { id: input.id } });
    if (!p || p.isDemo !== actor.isDemo)
      throw new Error("Publicação não encontrada.");
    if (p.status !== "PENDING")
      throw new Error("Esta publicação já foi revisada.");
    const assignee = await tx.user.findUnique({
      where: { id: input.assigneeId },
    });
    if (!assignee?.active || assignee.isDemo !== actor.isDemo)
      throw new Error("Responsável inválido.");
    if (
      input.clientId &&
      !(await tx.client.findFirst({
        where: { id: input.clientId, isDemo: actor.isDemo },
      }))
    )
      throw new Error("Cliente inválido.");
    const changed = await tx.publication.updateMany({
      where: { id: p.id, status: "PENDING" },
      data: {
        status: input.decision,
        reviewedBy: actor.id,
        reviewedAt: new Date(),
        reviewNote: input.note,
        suggestion: input.suggestion,
        clientId: input.clientId || null,
      },
    });
    if (changed.count !== 1)
      throw new Error("Esta publicação já foi revisada.");
    if (input.decision === "APPROVED") {
      const task = await tx.task.create({
        data: {
          title: `Analisar publicação · ${p.caseNumber ?? "processo a identificar"}`,
          description: input.suggestion,
          assigneeId: input.assigneeId,
          clientId: input.clientId || null,
          publicationId: p.id,
          isDemo: actor.isDemo,
        },
      });
      await tx.outbox.create({ data: { taskId: task.id } });
      if (input.clientId)
        await tx.timelineEvent.create({
          data: {
            clientId: input.clientId,
            title: "Publicação validada; tarefa criada, sem prazo presumido.",
          },
        });
    }
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: `PUBLICATION_${input.decision}`,
        entityType: "Publication",
        entityId: p.id,
        detail: "Revisão humana registrada. Nenhum prazo calculado.",
        isDemo: actor.isDemo,
      },
    });
  });
}
