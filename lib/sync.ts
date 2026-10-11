import { createHash } from "node:crypto";
import { z } from "zod";
import { db } from "./db";
import type { TaskStatus } from "@prisma/client";
import { demoMode, externalWritesAllowed } from "./policy";
import { extractPublications } from "./publications";
import {
  graph,
  graphToken,
  notion,
  required,
  propertyText,
  readLeadRows,
  ProviderError,
  type NotionPage,
} from "./providers";
export type Target = "outlook" | "onedrive" | "notion" | "outbox";
function safeError(error: unknown) {
  if (error instanceof ProviderError) return error.message;
  if (
    error instanceof Error &&
    (error.message.startsWith("Configuração ausente:") ||
      error.message.startsWith("Tabela nomeada") ||
      error.message.startsWith("A tabela de leads"))
  )
    return error.message;
  return "Falha de sincronização. Verifique permissões, schema, disponibilidade e logs do provedor. Nenhum segredo é registrado.";
}
export async function synchronize(target: Target, actorId = "worker") {
  if (demoMode())
    return {
      ok: false,
      message: "Conectores reais estão desativados na demonstração.",
    };
  await db.syncState.upsert({
    where: { key: target },
    create: { key: target },
    update: {},
  });
  const now = new Date();
  const lease = await db.syncState.updateMany({
    where: {
      key: target,
      OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }],
    },
    data: { lockedUntil: new Date(Date.now() + 30 * 60 * 1000) },
  });
  if (!lease.count)
    return { ok: false, message: "Já existe uma sincronização em andamento." };
  try {
    if (target === "outlook") await importOutlook();
    if (target === "onedrive") await importDrive();
    if (target === "notion") await importNotion();
    if (target === "outbox") {
      if (!externalWritesAllowed())
        throw new Error("Escrita externa desativada.");
      await dispatchOutbox();
    }
    await db.syncState.update({
      where: { key: target },
      data: { lastSuccessAt: new Date(), lastError: null },
    });
    await db.auditLog.create({
      data: {
        actorId,
        action: "SYNC_COMPLETED",
        entityType: "Integration",
        entityId: target,
        detail: "Execução concluída; sem conteúdo sigiloso no log.",
      },
    });
    return { ok: true, message: "Sincronização concluída." };
  } catch (error) {
    const message =
      error instanceof Error && error.message === "Escrita externa desativada."
        ? error.message
        : safeError(error);
    await db.syncState.update({
      where: { key: target },
      data: { lastError: message },
    });
    await db.auditLog.create({
      data: {
        actorId,
        action: "SYNC_FAILED",
        entityType: "Integration",
        entityId: target,
        detail: message,
      },
    });
    return { ok: false, message };
  } finally {
    await db.syncState.update({
      where: { key: target },
      data: { lockedUntil: null },
    });
  }
}
async function importOutlook() {
  const token = await graphToken();
  const mailbox = required("OUTLOOK_MAILBOX");
  const sender = required("JUSBRASIL_SENDER").toLowerCase();
  const state = await db.syncState.findUnique({ where: { key: "outlook" } });
  const cutoff =
    state?.cursor ?? new Date(Date.now() - 30 * 86400000).toISOString();
  const startedAt = new Date().toISOString();
  const params = new URLSearchParams({
    $top: "50",
    $select: "id,from,sender,subject,body,receivedDateTime,webLink",
    $filter: `receivedDateTime ge ${cutoff}`,
    $orderby: "receivedDateTime asc",
  });
  let next: string | undefined =
    `users/${encodeURIComponent(mailbox)}/messages?${params}`;
  let pages = 0;
  while (next) {
    if (++pages > 100)
      throw new Error(
        "Limite de páginas Outlook excedido. Reduza a janela inicial.",
      );
    const response = await graph(token, next);
    for (const message of response.value ?? []) {
      if (
        message.from?.emailAddress?.address?.toLowerCase() !== sender ||
        message.sender?.emailAddress?.address?.toLowerCase() !== sender
      )
        continue;
      for (const p of extractPublications(
        message.body?.content ?? "",
        message.id,
      )) {
        await db.publication.upsert({
          where: { fingerprint: p.fingerprint },
          create: { ...p, sourceUrl: message.webLink },
          update: {},
        });
      }
    }
    next = response["@odata.nextLink"];
  }
  // Margem de 5 minutos: reprocessamento idempotente cobre chegada tardia.
  await db.syncState.update({
    where: { key: "outlook" },
    data: {
      cursor: new Date(new Date(startedAt).getTime() - 300000).toISOString(),
    },
  });
}
async function importDrive() {
  const token = await graphToken();
  const drive = required("ONEDRIVE_DRIVE_ID"),
    root = required("ONEDRIVE_ROOT_ID");
  const state = await db.syncState.findUnique({ where: { key: "onedrive" } });
  let next: string | undefined =
    state?.cursor ??
    `drives/${encodeURIComponent(drive)}/items/${encodeURIComponent(root)}/delta`;
  let cursor: string | undefined;
  let pages = 0;
  while (next) {
    if (++pages > 100) throw new Error("Limite de páginas OneDrive excedido.");
    const response = await graph(token, next);
    for (const item of response.value ?? []) {
      const remoteId = `${drive}:${item.id}`;
      if (item.deleted) {
        await db.document.updateMany({
          where: { remoteId },
          data: { kind: "REMOVIDO NA FONTE" },
        });
        continue;
      }
      if (!item.webUrl) continue;
      const data = {
        name: item.name,
        url: item.webUrl,
        kind: item.folder ? "Pasta" : "Documento",
        modifiedAt: new Date(item.lastModifiedDateTime ?? Date.now()),
      };
      await db.document.upsert({
        where: { remoteId },
        create: { remoteId, ...data },
        update: data,
      });
    }
    next = response["@odata.nextLink"];
    cursor = response["@odata.deltaLink"] ?? cursor;
  }
  if (process.env.ONEDRIVE_LEADS_ITEM_ID) {
    for (const lead of await readLeadRows(token)) {
      if (!lead.name || !z.email().safeParse(lead.email).success) continue;
      // Linha/posição nunca serve de identidade: e-mail normalizado permite reordenação.
      const remoteLeadId = createHash("sha256")
        .update(`${drive}|${process.env.ONEDRIVE_LEADS_ITEM_ID}|${lead.email}`)
        .digest("hex");
      await db.$transaction(async (tx) => {
        const prior = await tx.client.findFirst({
          where: {
            isDemo: false,
            OR: [{ remoteLeadId }, { email: lead.email }],
          },
        });
        if (prior) {
          if (!prior.remoteLeadId)
            await tx.client.update({
              where: { id: prior.id },
              data: { remoteLeadId },
            });
          return;
        }
        const c = await tx.client.create({
          data: {
            name: lead.name,
            email: lead.email,
            phone: lead.phone,
            active: false,
            remoteLeadId,
          },
        });
        await tx.proposal.create({
          data: {
            clientId: c.id,
            title: "Lead importado — revisar etapa e valor",
            stage: "LEAD",
            value: 0,
          },
        });
        await tx.timelineEvent.create({
          data: {
            clientId: c.id,
            title: "Lead importado do OneDrive; requer revisão comercial.",
          },
        });
      });
    }
  }
  if (cursor)
    await db.syncState.update({ where: { key: "onedrive" }, data: { cursor } });
}
async function eachNotion(
  databaseId: string,
  visit: (p: NotionPage) => Promise<void>,
) {
  let cursor: string | undefined;
  let pages = 0;
  do {
    if (++pages > 100) throw new Error("Limite de páginas Notion excedido.");
    const result = await notion(`databases/${databaseId}/query`, {
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    });
    for (const p of result.results as NotionPage[])
      if (p.properties) await visit(p);
    cursor = result.has_more ? result.next_cursor : undefined;
  } while (cursor);
}
async function importNotion() {
  const assignee = await db.user.findFirst({
    where: { role: "LEGAL", active: true, isDemo: false },
  });
  if (!assignee) throw new Error("Responsável jurídico não provisionado.");
  const titleProp = process.env.NOTION_TITLE_PROPERTY ?? "Nome",
    statusProp = process.env.NOTION_STATUS_PROPERTY ?? "Status",
    idProp = process.env.NOTION_EXTERNAL_ID_PROPERTY ?? "JDA ID";
  const schema = await notion(`databases/${required("NOTION_DATABASE_ID")}`);
  if (
    schema.properties?.[titleProp]?.type !== "title" ||
    schema.properties?.[statusProp]?.type !== "status" ||
    schema.properties?.[idProp]?.type !== "rich_text"
  )
    throw new Error("Schema de tarefas Notion incompatível.");
  await eachNotion(required("NOTION_DATABASE_ID"), async (p) => {
    const linked = propertyText(p, idProp);
    // Páginas criadas por nós já estão vinculadas; não substituir tarefa revisada.
    const existing = await db.task.findFirst({
      where: {
        OR: [{ notionPageId: p.id }, ...(linked ? [{ id: linked }] : [])],
      },
    });
    if (existing?.source !== "NOTION" && existing) {
      if (!existing.isDemo && !existing.notionPageId)
        await db.task.update({
          where: { id: existing.id },
          data: { notionPageId: p.id },
        });
      return;
    }
    const title = propertyText(p, titleProp);
    if (!title) return;
    const statusName = p.properties[statusProp]?.status?.name ?? "";
    const status: TaskStatus = /conclu|done/i.test(statusName)
      ? "DONE"
      : /andamento|progress/i.test(statusName)
        ? "IN_PROGRESS"
        : "PENDING";
    const remoteUpdatedAt = new Date(p.last_edited_time);
    if (existing?.localDirty) {
      if (
        !existing.remoteUpdatedAt ||
        remoteUpdatedAt > existing.remoteUpdatedAt
      )
        await db.task.update({
          where: { id: existing.id },
          data: {
            syncConflict:
              "Fonte Notion alterada após edição local. Conferência manual necessária.",
          },
        });
      return;
    }
    const data = {
      title,
      status,
      completedAt: status === "DONE" ? new Date() : null,
      remoteUpdatedAt,
      syncConflict: null,
    };
    await db.task.upsert({
      where: { notionPageId: p.id },
      create: {
        ...data,
        source: "NOTION",
        description:
          "Importada do Notion. Consulte a fonte para o conteúdo completo; vínculo de cliente e responsável precisam ser conferidos.",
        assigneeId: assignee.id,
        notionPageId: p.id,
      },
      update: data,
    });
  });
  if (process.env.NOTION_MEETINGS_DATABASE_ID)
    await eachNotion(process.env.NOTION_MEETINGS_DATABASE_ID, async (p) => {
      const titleField = Object.entries(p.properties).find(
        ([, v]) => v.type === "title",
      )?.[0];
      if (!titleField) return;
      const data = {
        title: propertyText(p, titleField),
        url: p.url,
        happenedAt: new Date(
          p.properties["Data"]?.date?.start ?? p.created_time,
        ),
      };
      await db.meeting.upsert({
        where: { remoteId: p.id },
        create: { remoteId: p.id, ...data },
        update: data,
      });
    });
}
async function dispatchOutbox() {
  const jobs = await db.outbox.findMany({
    where: {
      task: { isDemo: false, publication: { status: "APPROVED" } },
      OR: [
        {
          status: { in: ["PENDING", "FAILED"] },
          nextAttemptAt: { lte: new Date() },
        },
        { status: "PROCESSING", lockedUntil: { lt: new Date() } },
      ],
    },
    include: { task: { include: { publication: true } } },
    take: 25,
    orderBy: { nextAttemptAt: "asc" },
  });
  for (const job of jobs) {
    const claim = await db.outbox.updateMany({
      where: {
        id: job.id,
        status: job.status,
        OR: [{ lockedUntil: null }, { lockedUntil: { lt: new Date() } }],
      },
      data: {
        status: "PROCESSING",
        lockedUntil: new Date(Date.now() + 120000),
        attempts: { increment: 1 },
      },
    });
    if (!claim.count) continue;
    try {
      const database = required("NOTION_DATABASE_ID"),
        idProp = process.env.NOTION_EXTERNAL_ID_PROPERTY ?? "JDA ID";
      const found = await notion(`databases/${database}/query`, {
        filter: { property: idProp, rich_text: { equals: job.taskId } },
        page_size: 2,
      });
      if (found.results.length > 1)
        throw new Error(
          "Múltiplas páginas com mesmo JDA ID; reconciliação manual necessária.",
        );
      const page =
        found.results[0] ??
        (await notion("pages", {
          parent: { database_id: database },
          properties: {
            [process.env.NOTION_TITLE_PROPERTY ?? "Nome"]: {
              title: [{ text: { content: job.task.title.slice(0, 200) } }],
            },
            [idProp]: { rich_text: [{ text: { content: job.taskId } }] },
            [process.env.NOTION_STATUS_PROPERTY ?? "Status"]: {
              status: {
                name: process.env.NOTION_PENDING_STATUS ?? "Não iniciada",
              },
            },
          },
          children: Array.from(
            { length: Math.ceil(job.task.description.length / 1900) },
            (_, i) => ({
              object: "block",
              type: "paragraph",
              paragraph: {
                rich_text: [
                  {
                    type: "text",
                    text: {
                      content: job.task.description.slice(
                        i * 1900,
                        (i + 1) * 1900,
                      ),
                    },
                  },
                ],
              },
            }),
          ),
        }));
      await db.$transaction(async (tx) => {
        await tx.task.update({
          where: { id: job.taskId },
          data: { notionPageId: page.id },
        });
        await tx.outbox.update({
          where: { id: job.id },
          data: {
            status: "SENT",
            sentAt: new Date(),
            lockedUntil: null,
            lastError: null,
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: "worker",
            action: "NOTION_TASK_SENT",
            entityType: "Task",
            entityId: job.taskId,
            detail: "Tarefa aprovada vinculada à página Notion.",
          },
        });
      });
    } catch (error) {
      await db.outbox.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          lastError: safeError(error),
          lockedUntil: null,
          nextAttemptAt: new Date(
            Date.now() +
              Math.min(3600000, 30000 * 2 ** Math.min(job.attempts, 7)),
          ),
        },
      });
      throw error;
    }
  }
}
