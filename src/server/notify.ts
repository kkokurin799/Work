import { moscowToday, isWeekdayMorningWindow } from "../domain/dates";
import { digestText, t14Text, type NoticeItem } from "../domain/messages";
import { label, BENEFICIARIES } from "../domain/labels";
import { query } from "../db/pool";
import { ownerChat } from "./auth";
import { sendTelegram } from "./telegram";

const TASKS = `
  SELECT t.number, t.description, t.due_date, t.side, t.beneficiary, t.kind, t.id,
         pe.name AS assignee, c.name AS client_name, p.number AS project_number, p.name AS project_name,
         work_attention(t.status, p.status, t.due_date, $1::date) AS attention
  FROM tasks t
  JOIN people pe ON pe.id = t.person_id
  LEFT JOIN clients c ON c.id = t.client_id
  LEFT JOIN projects p ON p.id = t.project_id
`;

export async function deliverDueNotices(today = moscowToday(), send: (chatId: string, text: string) => Promise<void> = sendTelegram): Promise<number> {
  if (!(await tryLock(41001))) return 0;
  try {
    const rows = await query<Record<string, unknown>>(
      `${TASKS}
       WHERE t.t14_due_date IS NULL
         AND work_attention(t.status, p.status, t.due_date, $1::date) IN ('soon', 'overdue')
       ORDER BY t.due_date`,
      [today],
    );
    const owner = await ownerChat();
    let sent = 0;
    for (const row of rows) {
      const text = t14Text(notice(row), today, baseUrl());
      const delivery = await query<{ id: string }>(
        "INSERT INTO alert_deliveries (kind, task_id, payload, status) VALUES ('t14', $1, $2, 'pending') RETURNING id",
        [row.id, text],
      );
      try {
        if (!owner?.chatId) throw new Error("Нет чата Telegram. Напишите боту первым сообщением.");
        await send(owner.chatId, text);
        await query("UPDATE alert_deliveries SET status = 'sent', sent_at = now(), error = NULL WHERE id = $1", [delivery[0].id]);
        await query("UPDATE tasks SET t14_due_date = due_date WHERE id = $1", [row.id]);
        sent += 1;
      } catch (error) {
        await query("UPDATE alert_deliveries SET status = 'failed', error = $2 WHERE id = $1", [
          delivery[0].id,
          error instanceof Error ? error.message : "Ошибка отправки",
        ]);
      }
    }
    return sent;
  } finally {
    await unlock(41001);
  }
}

export async function deliverDigest(now = new Date(), send: (chatId: string, text: string) => Promise<void> = sendTelegram): Promise<boolean> {
  if (!isWeekdayMorningWindow(now)) return false;
  if (!(await tryLock(41002))) return false;
  const today = moscowToday(now);
  try {
    const existing = await query<{ id: string; status: string }>(
      "SELECT id, status FROM alert_deliveries WHERE kind = 'digest' AND digest_date = $1",
      [today],
    );
    if (existing[0]?.status === "sent") return false;
    const rows = await query<Record<string, unknown>>(
      `${TASKS}
       WHERE work_attention(t.status, p.status, t.due_date, $1::date) IN ('soon', 'overdue', 'undated')
       ORDER BY t.number`,
      [today],
    );
    const text = digestText(rows.map(notice), today, baseUrl());
    const owner = await ownerChat();
    let deliveryId = existing[0]?.id;
    if (!deliveryId) {
      const created = await query<{ id: string }>(
        "INSERT INTO alert_deliveries (kind, digest_date, payload, status) VALUES ('digest', $1, $2, 'pending') RETURNING id",
        [today, text],
      );
      deliveryId = created[0].id;
    }
    try {
      if (!owner?.chatId) throw new Error("Нет чата Telegram. Напишите боту первым сообщением.");
      await send(owner.chatId, text);
      await query("UPDATE alert_deliveries SET status = 'sent', sent_at = now(), payload = $2, error = NULL WHERE id = $1", [
        deliveryId,
        text,
      ]);
      return true;
    } catch (error) {
      await query("UPDATE alert_deliveries SET status = 'failed', payload = $2, error = $3 WHERE id = $1", [
        deliveryId,
        text,
        error instanceof Error ? error.message : "Ошибка отправки",
      ]);
      return false;
    }
  } finally {
    await unlock(41002);
  }
}

function notice(row: Record<string, unknown>): NoticeItem {
  const beneficiary = row.beneficiary ? String(row.beneficiary) : null;
  const beneficiaryLabel = !beneficiary
    ? null
    : beneficiary === "client"
      ? String(row.client_name ?? "клиент")
      : label(BENEFICIARIES, beneficiary);
  const attention = String(row.attention);
  return {
    number: String(row.number),
    description: String(row.description),
    dueDate: (row.due_date as string | null) ?? null,
    assignee: String(row.assignee),
    side: (row.side as string | null) ?? null,
    beneficiaryLabel,
    projectNumber: (row.project_number as string | null) ?? null,
    projectName: (row.project_name as string | null) ?? null,
    attention: attention === "overdue" || attention === "undated" ? attention : "soon",
  };
}

function baseUrl(): string {
  return process.env.APP_BASE_URL || "http://localhost:3000";
}

async function tryLock(key: number): Promise<boolean> {
  const rows = await query<{ locked: boolean }>("SELECT pg_try_advisory_lock($1) AS locked", [key]);
  return rows[0]?.locked === true;
}

async function unlock(key: number): Promise<void> {
  await query("SELECT pg_advisory_unlock($1)", [key]);
}
