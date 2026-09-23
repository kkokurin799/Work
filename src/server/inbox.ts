import { parseMessage } from "../domain/parse";
import { txQuery, withTx, query } from "../db/pool";
import { InputError } from "./errors";
import { applyParsed, createProject, createTask, type ProjectInput, type TaskInput } from "./records";
import { ownerChat, rememberTelegramChat } from "./auth";

export type Inbound = {
  id: string;
  channel: string;
  sender: string;
  rawText: string;
  receivedAt: string;
  parseStatus: string;
  parseError: string | null;
  parsed: unknown;
  taskId: string | null;
  projectId: string | null;
  reply: string | null;
};

export async function ingest(input: {
  channel: "telegram" | "email";
  externalId: string;
  sender: string;
  rawText: string;
  allowed: boolean;
  telegramUserId?: string | null;
  telegramChatId?: string | null;
}): Promise<{ status: string; reply: string }> {
  const rawText = input.rawText.slice(0, 20000);
  return withTx(async (client) => {
    const inserted = await txQuery<{ id: string }>(
      client,
      `INSERT INTO inbound_messages (channel, external_id, sender, raw_text, parse_status)
       VALUES ($1, $2, $3, $4, 'needs_review')
       ON CONFLICT (channel, external_id) DO NOTHING
       RETURNING id`,
      [input.channel, input.externalId, input.sender, rawText],
    );
    if (!inserted[0]) {
      const existing = await txQuery<{ reply: string | null; parse_status: string }>(
        client,
        "SELECT reply, parse_status FROM inbound_messages WHERE channel = $1 AND external_id = $2",
        [input.channel, input.externalId],
      );
      return { status: "duplicate", reply: existing[0]?.reply || "Уже разобрано ранее." };
    }
    const id = inserted[0].id;
    if (!input.allowed) {
      await txQuery(
        client,
        "UPDATE inbound_messages SET parse_status = 'rejected', parse_error = 'Отправитель не разрешён.', reply = '' WHERE id = $1",
        [id],
      );
      return { status: "rejected", reply: "" };
    }
    if (input.telegramChatId && input.telegramUserId) {
      const owner = await ownerChat();
      if (owner) await rememberTelegramChat(owner.userId, input.telegramUserId, input.telegramChatId);
    }
    const parsed = parseMessage(rawText);
    await txQuery(client, "UPDATE inbound_messages SET parsed_json = $2::jsonb WHERE id = $1", [id, JSON.stringify(parsed)]);
    if (!parsed.ok) {
      const reply = `Не записал. ${parsed.errors.join(" ")} Сообщение лежит во входящих.`;
      await txQuery(client, "UPDATE inbound_messages SET parse_status = 'needs_review', parse_error = $2, reply = $3 WHERE id = $1", [
        id,
        parsed.errors.join(" "),
        reply,
      ]);
      return { status: "needs_review", reply };
    }
    const owner = await ownerChat();
    if (!owner) throw new InputError({ owner: "Владелец не заведён." });
    try {
      await client.query("SAVEPOINT apply_msg");
      const applied = await applyParsed(client, parsed, owner.userId, input.channel, id);
      await client.query("RELEASE SAVEPOINT apply_msg");
      await txQuery(
        client,
        `UPDATE inbound_messages
         SET parse_status = 'applied', parse_error = NULL, reply = $2, task_id = $3, project_id = COALESCE($4, project_id)
         WHERE id = $1`,
        [id, applied.reply, applied.taskId, applied.projectId],
      );
      return { status: "applied", reply: applied.reply };
    } catch (error) {
      if (!(error instanceof InputError)) throw error;
      await client.query("ROLLBACK TO SAVEPOINT apply_msg");
      const reply = `Не записал. ${error.message} Сообщение лежит во входящих.`;
      await txQuery(client, "UPDATE inbound_messages SET parse_status = 'needs_review', parse_error = $2, reply = $3 WHERE id = $1", [
        id,
        error.message,
        reply,
      ]);
      return { status: "needs_review", reply };
    }
  });
}

export async function listInbox(status?: string | null): Promise<Inbound[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM inbound_messages
     WHERE ($1::text IS NULL OR parse_status = $1)
     ORDER BY received_at DESC
     LIMIT 200`,
    [status ?? null],
  );
  return rows.map(mapInbound);
}

export async function getInbound(id: string): Promise<Inbound | null> {
  const rows = await query<Record<string, unknown>>("SELECT * FROM inbound_messages WHERE id = $1", [id]);
  return rows[0] ? mapInbound(rows[0]) : null;
}

export async function rejectInbound(id: string): Promise<void> {
  const rows = await query("UPDATE inbound_messages SET parse_status = 'rejected', reply = 'Отклонено.' WHERE id = $1 AND parse_status = 'needs_review' RETURNING id", [id]);
  if (!rows.length) throw new InputError({ inbox: "Сообщение уже разобрано или не найдено." });
}

export async function applyInboundForm(id: string, input: ProjectInput | TaskInput, userId: string): Promise<string> {
  const message = await getInbound(id);
  if (!message || message.parseStatus !== "needs_review") {
    throw new InputError({ inbox: "Сообщение уже разобрано или не найдено." });
  }
  if ("name" in input) {
    const project = await createProject({ ...input, inboundId: id, source: "manual" }, userId);
    await query(
      "UPDATE inbound_messages SET parse_status = 'applied', parse_error = NULL, reply = $2, project_id = $3 WHERE id = $1",
      [id, `Проведено: ${project.number}`, project.id],
    );
    return project.number;
  }
  const task = await createTask({ ...input, inboundId: id, source: "manual" }, userId);
  await query(
    "UPDATE inbound_messages SET parse_status = 'applied', parse_error = NULL, reply = $2, task_id = $3, project_id = $4 WHERE id = $1",
    [id, `Проведено: ${task.number}`, task.id, task.projectId],
  );
  return task.number;
}

function mapInbound(row: Record<string, unknown>): Inbound {
  return {
    id: String(row.id),
    channel: String(row.channel),
    sender: String(row.sender),
    rawText: String(row.raw_text),
    receivedAt: String(row.received_at),
    parseStatus: String(row.parse_status),
    parseError: (row.parse_error as string | null) ?? null,
    parsed: row.parsed_json,
    taskId: (row.task_id as string | null) ?? null,
    projectId: (row.project_id as string | null) ?? null,
    reply: (row.reply as string | null) ?? null,
  };
}
