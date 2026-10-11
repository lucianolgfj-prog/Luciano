"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actor, admin } from "@/lib/auth";
import { db } from "@/lib/db";
import { permissions } from "@/lib/policy";
import { changeTask, reviewPublication } from "@/lib/workflow";
import { synchronize } from "@/lib/sync";
const text = (f: FormData, key: string) => String(f.get(key) ?? "").trim();
function refresh() {
  revalidatePath("/", "layout");
}
export async function saveClient(f: FormData) {
  const user = await actor();
  if (!permissions.clients(user.role))
    throw new Error("Permissão insuficiente.");
  const data = z
    .object({
      name: z.string().min(3).max(160),
      taxId: z.string().max(30),
      email: z.union([z.email(), z.literal("")]),
      phone: z.string().max(40),
      notes: z.string().max(3000),
    })
    .parse(
      Object.fromEntries(
        ["name", "taxId", "email", "phone", "notes"].map((k) => [
          k,
          text(f, k),
        ]),
      ),
    );
  const id = text(f, "id");
  const saved = await db.$transaction(async (tx) => {
    if (
      id &&
      !(await tx.client.findFirst({ where: { id, isDemo: user.isDemo } }))
    )
      throw new Error("Cliente indisponível.");
    const c = id
      ? await tx.client.update({
          where: { id },
          data: { ...data, active: text(f, "active") === "true" },
        })
      : await tx.client.create({ data: { ...data, isDemo: user.isDemo } });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: id ? "CLIENT_UPDATED" : "CLIENT_CREATED",
        entityType: "Client",
        entityId: c.id,
        detail: "Cadastro alterado.",
        isDemo: user.isDemo,
      },
    });
    await tx.timelineEvent.create({
      data: {
        clientId: c.id,
        title: id ? "Dados cadastrais atualizados" : "Cliente cadastrado",
      },
    });
    return c;
  });
  refresh();
  redirect(`/clientes/${saved.id}`);
}
export async function createTask(f: FormData) {
  const user = await admin();
  const data = z
    .object({
      title: z.string().min(3).max(200),
      description: z.string().min(3).max(5000),
      assigneeId: z.string().min(1),
      clientId: z.string(),
      dueAt: z.string(),
    })
    .parse(
      Object.fromEntries(
        ["title", "description", "assigneeId", "clientId", "dueAt"].map((k) => [
          k,
          text(f, k),
        ]),
      ),
    );
  const dueAt = data.dueAt
    ? z.coerce.date().parse(`${data.dueAt}T23:59:59-03:00`)
    : null;
  await db.$transaction(async (tx) => {
    if (
      !(await tx.user.findFirst({
        where: { id: data.assigneeId, active: true, isDemo: user.isDemo },
      }))
    )
      throw new Error("Responsável inválido.");
    if (
      data.clientId &&
      !(await tx.client.findFirst({
        where: { id: data.clientId, isDemo: user.isDemo },
      }))
    )
      throw new Error("Cliente inválido.");
    const task = await tx.task.create({
      data: {
        title: data.title,
        description: data.description,
        assigneeId: data.assigneeId,
        clientId: data.clientId || null,
        dueAt,
        isDemo: user.isDemo,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "TASK_CREATED",
        entityType: "Task",
        entityId: task.id,
        detail: "Tarefa cadastrada manualmente.",
        isDemo: user.isDemo,
      },
    });
    if (data.clientId)
      await tx.timelineEvent.create({
        data: { clientId: data.clientId, title: `Nova tarefa: ${data.title}` },
      });
  });
  refresh();
}
export async function setTaskStatus(f: FormData) {
  const user = await actor();
  const status = z
    .enum(["PENDING", "IN_PROGRESS", "DONE"])
    .parse(text(f, "status"));
  await changeTask(user, text(f, "id"), status);
  refresh();
}
export async function decidePublication(f: FormData) {
  const user = await admin();
  const decision = z.enum(["APPROVED", "REJECTED"]).parse(text(f, "decision"));
  if (decision === "APPROVED" && text(f, "officialChecked") !== "on")
    throw new Error("Confirme a conferência na fonte oficial.");
  await reviewPublication(user, {
    id: text(f, "id"),
    decision,
    assigneeId: text(f, "assigneeId"),
    clientId: text(f, "clientId") || undefined,
    suggestion: z.string().min(10).max(5000).parse(text(f, "suggestion")),
    note: z.string().min(3).max(2000).parse(text(f, "note")),
  });
  refresh();
}
export async function saveProposal(f: FormData) {
  const user = await actor();
  if (!permissions.finance(user.role))
    throw new Error("Permissão insuficiente.");
  const id = text(f, "id");
  const stage = z
    .enum(["LEAD", "MEETING", "PROPOSAL", "WON", "LOST"])
    .parse(text(f, "stage"));
  await db.$transaction(async (tx) => {
    let p;
    if (id) {
      const prior = await tx.proposal.findFirst({
        where: { id, client: { isDemo: user.isDemo } },
      });
      if (!prior) throw new Error("Proposta indisponível.");
      p = await tx.proposal.update({ where: { id }, data: { stage } });
    } else {
      const clientId = text(f, "clientId");
      if (
        !(await tx.client.findFirst({
          where: { id: clientId, isDemo: user.isDemo },
        }))
      )
        throw new Error("Cliente inválido.");
      p = await tx.proposal.create({
        data: {
          clientId,
          stage,
          title: z.string().min(3).max(200).parse(text(f, "title")),
          value: z.coerce
            .number()
            .min(0)
            .max(999999999)
            .parse(text(f, "value")),
        },
      });
    }
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "PROPOSAL_UPDATED",
        entityType: "Proposal",
        entityId: p.id,
        detail: `Etapa: ${stage}`,
        isDemo: user.isDemo,
      },
    });
    await tx.timelineEvent.create({
      data: { clientId: p.clientId, title: `Proposta ${p.title}: ${stage}` },
    });
  });
  refresh();
}
export async function addService(f: FormData) {
  const user = await admin();
  const clientId = text(f, "clientId");
  const name = z.string().min(3).max(200).parse(text(f, "name"));
  const monthlyFee = z.coerce
    .number()
    .min(0)
    .max(999999999)
    .parse(text(f, "monthlyFee"));
  const startsAt = z.coerce
    .date()
    .parse(`${text(f, "startsAt")}T00:00:00-03:00`);
  const endsAt = text(f, "endsAt")
    ? z.coerce.date().parse(`${text(f, "endsAt")}T00:00:00-03:00`)
    : null;
  if (endsAt && endsAt <= startsAt)
    throw new Error("A data final deve ser posterior à inicial.");
  await db.$transaction(async (tx) => {
    if (
      !(await tx.client.findFirst({
        where: { id: clientId, isDemo: user.isDemo },
      }))
    )
      throw new Error("Cliente inválido.");
    const s = await tx.service.create({
      data: { clientId, name, monthlyFee, startsAt, endsAt },
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "SERVICE_CREATED",
        entityType: "Service",
        entityId: s.id,
        detail: "Serviço e vigência cadastrados.",
        isDemo: user.isDemo,
      },
    });
    await tx.timelineEvent.create({
      data: { clientId, title: `Serviço contratado: ${name}` },
    });
  });
  refresh();
}
export async function endService(f: FormData) {
  const user = await admin();
  const id = text(f, "id");
  const endsAt = z.coerce.date().parse(`${text(f, "endsAt")}T00:00:00-03:00`);
  await db.$transaction(async (tx) => {
    const s = await tx.service.findFirst({
      where: { id, client: { isDemo: user.isDemo } },
    });
    if (!s || endsAt <= s.startsAt)
      throw new Error("Serviço/data indisponível.");
    await tx.service.update({ where: { id }, data: { endsAt } });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "SERVICE_ENDED",
        entityType: "Service",
        entityId: id,
        detail: "Fim de vigência registrado.",
        isDemo: user.isDemo,
      },
    });
    await tx.timelineEvent.create({
      data: { clientId: s.clientId, title: `Fim de vigência: ${s.name}` },
    });
  });
  refresh();
}
export async function addCase(f: FormData) {
  const user = await actor();
  if (user.role === "COMMERCIAL") throw new Error("Permissão insuficiente.");
  const clientId = text(f, "clientId");
  if (
    !(await db.client.findFirst({
      where: { id: clientId, isDemo: user.isDemo },
    }))
  )
    throw new Error("Cliente inválido.");
  const data = z
    .object({
      number: z.string().min(3).max(80),
      court: z.string().min(2).max(100),
      kind: z.enum(["Judicial", "Administrativo"]),
      status: z.string().min(3).max(100),
    })
    .parse(
      Object.fromEntries(
        ["number", "court", "kind", "status"].map((k) => [k, text(f, k)]),
      ),
    );
  await db.$transaction(async (tx) => {
    const c = await tx.case.create({ data: { ...data, clientId } });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "CASE_CREATED",
        entityType: "Case",
        entityId: c.id,
        detail: "Processo vinculado.",
        isDemo: user.isDemo,
      },
    });
    await tx.timelineEvent.create({
      data: { clientId, title: `Processo vinculado: ${data.number}` },
    });
  });
  refresh();
}
export async function linkImported(f: FormData) {
  const user = await admin();
  const kind = z.enum(["document", "meeting", "task"]).parse(text(f, "kind"));
  const id = text(f, "id");
  const clientId = text(f, "clientId");
  if (
    !(await db.client.findFirst({
      where: { id: clientId, isDemo: user.isDemo },
    }))
  )
    throw new Error("Cliente inválido.");
  await db.$transaction(async (tx) => {
    if (kind === "document") {
      if (
        !(await tx.document.findFirst({ where: { id, isDemo: user.isDemo } }))
      )
        throw new Error("Documento inválido.");
      await tx.document.update({ where: { id }, data: { clientId } });
    }
    if (kind === "meeting") {
      if (!(await tx.meeting.findFirst({ where: { id, isDemo: user.isDemo } })))
        throw new Error("Ata inválida.");
      await tx.meeting.update({ where: { id }, data: { clientId } });
    }
    if (kind === "task") {
      if (!(await tx.task.findFirst({ where: { id, isDemo: user.isDemo } })))
        throw new Error("Tarefa inválida.");
      await tx.task.update({ where: { id }, data: { clientId } });
    }
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "SOURCE_LINKED",
        entityType: kind,
        entityId: id,
        detail: "Vínculo manual com cliente confirmado.",
        isDemo: user.isDemo,
      },
    });
    await tx.timelineEvent.create({
      data: {
        clientId,
        title: `Vínculo de ${kind === "document" ? "documento" : kind === "meeting" ? "ata" : "tarefa"} confirmado`,
      },
    });
  });
  refresh();
}
export async function runSync(f: FormData) {
  const user = await admin();
  const target = z
    .enum(["outlook", "onedrive", "notion", "outbox"])
    .parse(text(f, "target"));
  await synchronize(target, user.id);
  refresh();
}
export async function assignTask(f: FormData) {
  const user = await admin(),
    id = text(f, "id"),
    assigneeId = text(f, "assigneeId");
  const dueAt = text(f, "dueAt")
    ? z.coerce.date().parse(`${text(f, "dueAt")}T23:59:59-03:00`)
    : null;
  await db.$transaction(async (tx) => {
    if (
      !(await tx.task.findFirst({ where: { id, isDemo: user.isDemo } })) ||
      !(await tx.user.findFirst({
        where: { id: assigneeId, isDemo: user.isDemo, active: true },
      }))
    )
      throw new Error("Tarefa ou responsável inválido.");
    await tx.task.update({ where: { id }, data: { assigneeId, dueAt } });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "TASK_ASSIGNED",
        entityType: "Task",
        entityId: id,
        detail: "Responsável e data manual conferidos.",
        isDemo: user.isDemo,
      },
    });
  });
  refresh();
}
export async function acceptNotionSource(f: FormData) {
  const user = await admin(),
    id = text(f, "id");
  await db.$transaction(async (tx) => {
    if (
      !(await tx.task.findFirst({
        where: { id, isDemo: user.isDemo, source: "NOTION" },
      }))
    )
      throw new Error("Tarefa importada indisponível.");
    await tx.task.update({
      where: { id },
      data: { localDirty: false, syncConflict: null },
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "NOTION_SOURCE_ACCEPTED",
        entityType: "Task",
        entityId: id,
        detail:
          "Autorizada atualização local na próxima importação. Nenhuma escrita externa.",
        isDemo: user.isDemo,
      },
    });
  });
  refresh();
}
