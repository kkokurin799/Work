import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { addDays, moscowToday } from "../domain/dates";
import { attention } from "../domain/attention";
import { migrate } from "../db/migrate";
import { getPool, query } from "../db/pool";
import { authenticate } from "./auth";
import { createCatalog } from "./catalog";
import { ingest } from "./inbox";
import { deliverDueNotices } from "./notify";
import { createProject, createTask, getTask, listProjects, listTasks, resetBusinessData, updateProject, updateTask } from "./records";

const today = moscowToday();
const soon = addDays(today, 10);
const far = addDays(today, 40);
const yesterday = addDays(today, -1);

let userId = "";

beforeEach(async () => {
  await migrate();
  await resetBusinessData();
  const users = await query<{ id: string }>("SELECT id FROM users ORDER BY created_at LIMIT 1");
  userId = users[0].id;
  await query("UPDATE users SET telegram_chat_id = '100' WHERE id = $1", [userId]);
});

afterAll(async () => {
  await getPool().end();
});

describe("registry flow", () => {
  it("keeps a launch, filters by product, and counts the client side", async () => {
    const user = await authenticate(process.env.OWNER_EMAIL!, process.env.OWNER_PASSWORD!);
    expect(user.id).toBe(userId);
    const payments = await createCatalog("products", "Платежи");
    const billing = await createCatalog("products", "Биллинг");
    const alfa = await createCatalog("clients", "Альфа-Банк");
    const rollout = await createCatalog("teams", "Внедрение");
    const core = await createCatalog("teams", "Core");
    const project = await createProject(
      {
        name: "Запуск Платежей в Альфа-Банке",
        productId: payments.id,
        clientId: alfa.id,
        teamId: rollout.id,
        status: "active",
        dueDate: far,
      },
      userId,
    );
    const task = await createTask(
      {
        kind: "project_task",
        projectNumber: project.number,
        description: "Согласовать интеграционный контур",
        assigneeName: "Петрова",
        side: "client",
        dueDate: soon,
      },
      userId,
    );
    expect(task.number).toMatch(/^T-/);
    expect(task.side).toBe("client");
    const visible = await listProjects({ productId: payments.id });
    const hidden = await listProjects({ productId: billing.id });
    expect(visible.map((item) => item.number)).toContain(project.number);
    expect(hidden).toHaveLength(0);
    const onClient = await listTasks({ kind: "project_task", side: "client" });
    expect(onClient.some((item) => item.number === task.number && item.attention !== "closed")).toBe(true);
  });

  it("filters backlog by team, product, client and the control date", async () => {
    const payments = await createCatalog("products", "Платежи");
    const other = await createCatalog("products", "Другой");
    const alfa = await createCatalog("clients", "Альфа-Банк");
    const core = await createCatalog("teams", "Core");
    const rollout = await createCatalog("teams", "Внедрение");
    await createTask(
      {
        kind: "backlog",
        productId: payments.id,
        teamId: core.id,
        description: "Повтор платежа при таймауте",
        assigneeName: "Иванов",
        beneficiary: "client",
        clientId: alfa.id,
        status: "in_sprint",
        dueDate: soon,
      },
      userId,
    );
    await createTask(
      {
        kind: "backlog",
        productId: other.id,
        teamId: rollout.id,
        description: "Внутренняя уборка",
        assigneeName: "Иванов",
        beneficiary: "internal",
        dueDate: soon,
      },
      userId,
    );
    await createTask(
      {
        kind: "backlog",
        productId: payments.id,
        teamId: core.id,
        description: "Общее для всех",
        assigneeName: "Иванов",
        beneficiary: "all_clients",
        dueDate: far,
      },
      userId,
    );
    expect(await listTasks({ kind: "backlog", teamId: rollout.id })).toHaveLength(1);
    expect(await listTasks({ kind: "backlog", productId: other.id })).toHaveLength(1);
    const forAlfa = await listTasks({ kind: "backlog", clientId: alfa.id });
    expect(forAlfa.map((item) => item.description).sort()).toEqual(["Общее для всех", "Повтор платежа при таймауте"]);
    expect(await listTasks({ kind: "backlog", dueOnOrBefore: addDays(today, 9) })).toHaveLength(0);
    expect((await listTasks({ kind: "backlog", dueOnOrBefore: soon })).length).toBe(2);
  });

  it("turns the highlight off for a finished task and a paused project", async () => {
    const product = await createCatalog("products", "Платежи");
    const client = await createCatalog("clients", "Альфа-Банк");
    const team = await createCatalog("teams", "Внедрение");
    const project = await createProject(
      { name: "Пауза", productId: product.id, clientId: client.id, teamId: team.id, status: "active", dueDate: soon },
      userId,
    );
    const task = await createTask(
      {
        kind: "project_task",
        projectNumber: project.number,
        description: "Ждёт клиента",
        assigneeName: "Петрова",
        side: "client",
        dueDate: yesterday,
      },
      userId,
    );
    expect(task.attention).toBe("overdue");
    const done = await updateTask(task.number, { status: "done" }, userId);
    expect(done.attention).toBe("closed");
    const reopened = await updateTask(task.number, { status: "in_progress" }, userId);
    expect(reopened.attention).toBe("overdue");
    await updateProject(project.number, { status: "paused" }, userId);
    const paused = await getTask(task.number);
    expect(paused?.attention).toBe("closed");
  });

  it("stores raw messages, deduplicates them and updates only the sent fields", async () => {
    const product = await createCatalog("products", "Платежи");
    const client = await createCatalog("clients", "Альфа-Банк");
    const team = await createCatalog("teams", "Core");
    const created = await ingest({
      channel: "telegram",
      externalId: "42",
      sender: "1",
      rawText: `БЭКЛОГ
Продукт: Платежи
Описание: Повтор платежа при таймауте
Команда: Core
Ответственный: Иванов
Для кого: Альфа-Банк
Срок: ${dotted(soon)}
Статус: В спринте`,
      allowed: true,
    });
    expect(created.status).toBe("applied");
    expect(created.reply).toContain("Бэклог");
    const again = await ingest({
      channel: "telegram",
      externalId: "42",
      sender: "1",
      rawText: "ещё раз",
      allowed: true,
    });
    expect(again.status).toBe("duplicate");
    expect(await listTasks({ kind: "backlog" })).toHaveLength(1);
    const missing = await ingest({
      channel: "telegram",
      externalId: "43",
      sender: "1",
      rawText: `ЗАДАЧА
Проект: нет такого
Описание: Согласовать
Ответственный: Петрова`,
      allowed: true,
    });
    expect(missing.status).toBe("needs_review");
    expect(await listTasks({ kind: "project_task" })).toHaveLength(0);
    const item = (await listTasks({ kind: "backlog" }))[0];
    const updated = await ingest({
      channel: "telegram",
      externalId: "44",
      sender: "1",
      rawText: `БЭКЛОГ
Номер: ${item.number}
Срок: ${dotted(far)}`,
      allowed: true,
    });
    expect(updated.reply).toContain("обновлена");
    const after = await getTask(item.number);
    expect(after?.description).toBe("Повтор платежа при таймауте");
    expect(after?.dueDate).toBe(far);
    const unknown = await ingest({
      channel: "telegram",
      externalId: "45",
      sender: "1",
      rawText: `БЭКЛОГ
Продукт: Несуществующий
Описание: Что-то
Команда: Core
Ответственный: Иванов
Для кого: Альфа-Банк
Срок: ${dotted(soon)}`,
      allowed: true,
    });
    expect(unknown.status).toBe("needs_review");
    expect(unknown.reply).toContain("Не найден продукт");
    void product;
    void client;
    void team;
  });

  it("sends the 14-day notice once per wave and records the due-date change", async () => {
    const product = await createCatalog("products", "Платежи");
    const client = await createCatalog("clients", "Альфа-Банк");
    const team = await createCatalog("teams", "Внедрение");
    const project = await createProject(
      { name: "Срок", productId: product.id, clientId: client.id, teamId: team.id, dueDate: far },
      userId,
    );
    const task = await createTask(
      {
        kind: "project_task",
        projectNumber: project.number,
        description: "Согласовать интеграционный контур",
        assigneeName: "Петрова",
        side: "client",
        dueDate: soon,
      },
      userId,
    );
    const sent: string[] = [];
    expect(await deliverDueNotices(today, async (_chat, text) => void sent.push(text))).toBe(1);
    expect(sent[0]).toContain(task.number);
    expect(await deliverDueNotices(today, async () => undefined)).toBe(0);
    await updateTask(task.number, { dueDate: far }, userId);
    await updateTask(task.number, { dueDate: soon }, userId);
    expect(await deliverDueNotices(today, async () => undefined)).toBe(1);
    const history = await getTask(task.number);
    expect(history?.activity.some((item) => item.diff.due_date)).toBe(true);
    const sql = await query<{ value: string }>("SELECT work_attention('in_progress', 'active', $1::date, $2::date) AS value", [
      soon,
      today,
    ]);
    expect(sql[0].value).toBe(attention({ taskStatus: "in_progress", projectStatus: "active", dueDate: soon, today }));
  });
});

function dotted(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}.${month}.${year}`;
}
