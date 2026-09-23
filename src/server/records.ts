import type { PoolClient } from "pg";
import { moscowToday, parseUserDate } from "../domain/dates";
import { clearedT14Mark, type Attention } from "../domain/attention";
import { label, SIDES, BENEFICIARIES } from "../domain/labels";
import { intakeReply } from "../domain/messages";
import { canonicalBeneficiary, parseMessage, statusCode, type ParsedMessage, type RecordType } from "../domain/parse";
import { query, txQuery, withTx } from "../db/pool";
import { findActiveByName, findOrCreatePerson, suggestNames } from "./catalog";
import { InputError } from "./errors";

export type Filters = {
  teamId?: string | null;
  productId?: string | null;
  clientId?: string | null;
  dueOnOrBefore?: string | null;
};

export type ProjectCard = {
  id: string;
  number: string;
  name: string;
  productId: string;
  productName: string;
  clientId: string;
  clientName: string;
  teamId: string;
  teamName: string;
  status: string;
  dueDate: string | null;
  summary: string | null;
  openCount: number;
  clientSideCount: number;
  nearestDue: string | null;
  attention: Attention;
};

export type TaskCard = {
  id: string;
  kind: "project_task" | "backlog";
  number: string;
  description: string;
  externalNumber: string | null;
  projectId: string | null;
  projectNumber: string | null;
  projectName: string | null;
  projectStatus: string | null;
  productId: string;
  productName: string;
  teamId: string;
  teamName: string;
  personId: string;
  assignee: string;
  clientId: string | null;
  clientName: string | null;
  beneficiary: string | null;
  side: string | null;
  status: string;
  dueDate: string | null;
  t14DueDate: string | null;
  source: string;
  inboundMessageId: string | null;
  attention: Attention;
  createdAt: string;
  updatedAt: string;
};

export type ActivityItem = {
  action: string;
  diff: Record<string, { from: string | null; to: string | null }>;
  actor: string | null;
  createdAt: string;
};

const TASK_SELECT = `
  SELECT t.*,
    pr.name AS product_name,
    tm.name AS team_name,
    pe.name AS assignee,
    c.name AS client_name,
    p.number AS project_number,
    p.name AS project_name,
    p.status AS project_status,
    work_attention(t.status, p.status, t.due_date, $1::date) AS attention
  FROM tasks t
  JOIN products pr ON pr.id = t.product_id
  JOIN teams tm ON tm.id = t.team_id
  JOIN people pe ON pe.id = t.person_id
  LEFT JOIN clients c ON c.id = t.client_id
  LEFT JOIN projects p ON p.id = t.project_id
`;

export async function listProjects(filters: Filters, lifecycle?: string | null): Promise<ProjectCard[]> {
  const today = moscowToday();
  const list = await query<Record<string, unknown>>(
    `SELECT p.id, p.number, p.name, p.product_id, pr.name AS product_name, p.client_id, c.name AS client_name,
            p.team_id, tm.name AS team_name, p.status, p.due_date, p.summary,
            work_attention('todo', p.status, p.due_date, $1::date) AS self_attention,
            COALESCE(stats.open_count, 0) AS open_count,
            COALESCE(stats.client_side_count, 0) AS client_side_count,
            stats.nearest_due,
            stats.task_rank
     FROM projects p
     JOIN products pr ON pr.id = p.product_id
     JOIN clients c ON c.id = p.client_id
     JOIN teams tm ON tm.id = p.team_id
     LEFT JOIN LATERAL (
       SELECT count(*) FILTER (WHERE t.status NOT IN ('done', 'cancelled')) AS open_count,
              count(*) FILTER (WHERE t.status NOT IN ('done', 'cancelled') AND t.side = 'client') AS client_side_count,
              min(t.due_date) FILTER (WHERE t.status NOT IN ('done', 'cancelled')) AS nearest_due,
              min(CASE work_attention(t.status, p.status, t.due_date, $1::date)
                    WHEN 'overdue' THEN 0 WHEN 'soon' THEN 1 WHEN 'undated' THEN 2 WHEN 'ok' THEN 3 ELSE 9 END)
                FILTER (WHERE work_attention(t.status, p.status, t.due_date, $1::date) <> 'closed') AS task_rank
       FROM tasks t WHERE t.project_id = p.id
     ) stats ON true
     WHERE ($2::uuid IS NULL OR p.team_id = $2)
       AND ($3::uuid IS NULL OR p.product_id = $3)
       AND ($4::uuid IS NULL OR p.client_id = $4)
       AND ($5::date IS NULL OR (p.due_date IS NOT NULL AND p.due_date <= $5))
       AND ($6::text IS NULL OR ($6 = 'open' AND p.status IN ('preparing', 'active')))
     ORDER BY LEAST(
       CASE work_attention('todo', p.status, p.due_date, $1::date)
         WHEN 'overdue' THEN 0 WHEN 'soon' THEN 1 WHEN 'ok' THEN 2 WHEN 'undated' THEN 3 ELSE 4 END,
       COALESCE(stats.task_rank, 4)
     ), p.due_date NULLS LAST, p.number`,
    [today, filters.teamId ?? null, filters.productId ?? null, filters.clientId ?? null, filters.dueOnOrBefore ?? null, lifecycle ?? null],
  );
  return list.map(mapProject);
}

export async function getProject(number: string): Promise<(ProjectCard & { tasks: TaskCard[] }) | null> {
  const cards = await listProjects({});
  const project = cards.find((item) => item.number === number);
  if (!project) return null;
  const tasks = await listTasks({ projectNumber: number });
  return { ...project, tasks };
}

export async function listTasks(input: Filters & {
  kind?: string | null;
  projectNumber?: string | null;
  status?: string | null;
  side?: string | null;
  attention?: string | null;
  hot?: boolean;
  limit?: number | null;
}): Promise<TaskCard[]> {
  const today = moscowToday();
  const { query } = await import("../db/pool");
  const rows = await query<Record<string, unknown>>(
    `${TASK_SELECT}
     WHERE ($2::text IS NULL OR t.kind = $2)
       AND ($3::uuid IS NULL OR t.team_id = $3)
       AND ($4::uuid IS NULL OR t.product_id = $4)
       AND (
         $5::uuid IS NULL
         OR (t.kind = 'project_task' AND t.client_id = $5)
         OR (t.kind = 'backlog' AND (t.beneficiary = 'all_clients' OR (t.beneficiary = 'client' AND t.client_id = $5)))
       )
       AND ($6::date IS NULL OR (t.due_date IS NOT NULL AND t.due_date <= $6))
       AND ($7::text IS NULL OR p.number = $7)
       AND ($8::text IS NULL OR t.status = $8)
       AND ($9::text IS NULL OR t.side = $9)
       AND ($10::text IS NULL OR work_attention(t.status, p.status, t.due_date, $1::date) = $10)
       AND ($11::boolean = false OR work_attention(t.status, p.status, t.due_date, $1::date) IN ('soon', 'overdue'))
     ORDER BY CASE work_attention(t.status, p.status, t.due_date, $1::date)
       WHEN 'overdue' THEN 0 WHEN 'soon' THEN 1 WHEN 'ok' THEN 2 WHEN 'undated' THEN 3 ELSE 4 END,
       t.due_date NULLS LAST, t.number
     LIMIT COALESCE($12::int, 500)`,
    [
      today,
      input.kind ?? null,
      input.teamId ?? null,
      input.productId ?? null,
      input.clientId ?? null,
      input.dueOnOrBefore ?? null,
      input.projectNumber ?? null,
      input.status ?? null,
      input.side ?? null,
      input.attention ?? null,
      input.hot ?? false,
      input.limit ?? null,
    ],
  );
  return rows.map(mapTask);
}

export async function getTask(number: string): Promise<(TaskCard & { activity: ActivityItem[] }) | null> {
  const tasks = await listTasks({});
  const task = tasks.find((item) => item.number === number);
  if (!task) return null;
  const { query } = await import("../db/pool");
  const activity = await query<{ action: string; diff: ActivityItem["diff"]; actor: string | null; created_at: string }>(
    `SELECT a.action, a.diff, u.name AS actor, a.created_at
     FROM activity_log a
     LEFT JOIN users u ON u.id = a.actor_id
     WHERE a.entity_type = 'task' AND a.entity_id = $1
     ORDER BY a.created_at`,
    [task.id],
  );
  return {
    ...task,
    activity: activity.map((item) => ({
      action: item.action,
      diff: item.diff,
      actor: item.actor,
      createdAt: item.created_at,
    })),
  };
}

export type ProjectInput = {
  name: string;
  productId: string;
  clientId: string;
  teamId: string;
  status?: string;
  dueDate?: string | null;
  summary?: string | null;
  number?: string | null;
  source?: "manual" | "telegram" | "email";
  inboundId?: string | null;
};

export async function createProject(input: ProjectInput, userId: string): Promise<ProjectCard> {
  return withTx((client) => insertProject(client, input, userId));
}

export async function updateProject(number: string, patch: Partial<ProjectInput>, userId: string): Promise<ProjectCard> {
  return withTx(async (client) => {
    const current = await txQuery<Record<string, unknown>>(client, "SELECT * FROM projects WHERE number = $1", [number]);
    if (!current[0]) throw new InputError({ number: "Проект не найден." });
    const row = current[0];
    const next = {
      number: patch.number?.trim() || String(row.number),
      name: patch.name?.trim() || String(row.name),
      productId: patch.productId || String(row.product_id),
      clientId: patch.clientId || String(row.client_id),
      teamId: patch.teamId || String(row.team_id),
      status: patch.status || String(row.status),
      dueDate: patch.dueDate !== undefined ? emptyToNull(patch.dueDate) : (row.due_date as string | null),
      summary: patch.summary !== undefined ? emptyToNull(patch.summary) : (row.summary as string | null),
    };
    assertProject(next);
    await txQuery(
      client,
      `UPDATE projects
       SET number = $2, name = $3, product_id = $4, client_id = $5, team_id = $6, status = $7, due_date = $8, summary = $9, updated_at = now()
       WHERE id = $1`,
      [row.id, next.number, next.name, next.productId, next.clientId, next.teamId, next.status, next.dueDate, next.summary],
    );
    await txQuery(client, "UPDATE tasks SET product_id = $2, client_id = $3, updated_at = now() WHERE project_id = $1", [
      row.id,
      next.productId,
      next.clientId,
    ]);
    await writeDiff(client, userId, "project", String(row.id), {
      number: pair(row.number, next.number),
      name: pair(row.name, next.name),
      status: pair(row.status, next.status),
      due_date: pair(row.due_date, next.dueDate),
    });
    const cards = await listProjectsIn(client, {});
    const found = cards.find((item) => item.id === row.id);
    if (!found) throw new InputError({ number: "Проект не найден." });
    return found;
  });
}

export type TaskInput = {
  kind: "project_task" | "backlog";
  description: string;
  assigneeName: string;
  teamId?: string | null;
  status?: string | null;
  dueDate?: string | null;
  externalNumber?: string | null;
  projectNumber?: string | null;
  side?: string | null;
  productId?: string | null;
  beneficiary?: string | null;
  clientId?: string | null;
  number?: string | null;
  source?: "manual" | "telegram" | "email";
  inboundId?: string | null;
};

export async function createTask(input: TaskInput, userId: string): Promise<TaskCard> {
  return withTx((client) => insertTask(client, input, userId));
}

export async function updateTask(number: string, patch: Partial<TaskInput>, userId: string): Promise<TaskCard> {
  return withTx((client) => patchTask(client, number, patch, userId));
}

export async function projectActivity(projectId: string): Promise<ActivityItem[]> {
  const { query } = await import("../db/pool");
  const rows = await query<{ action: string; diff: ActivityItem["diff"]; actor: string | null; created_at: string }>(
    `SELECT a.action, a.diff, u.name AS actor, a.created_at
     FROM activity_log a LEFT JOIN users u ON u.id = a.actor_id
     WHERE a.entity_type = 'project' AND a.entity_id = $1
     ORDER BY a.created_at`,
    [projectId],
  );
  return rows.map((item) => ({ action: item.action, diff: item.diff, actor: item.actor, createdAt: item.created_at }));
}

export async function applyParsed(
  client: PoolClient,
  parsed: Extract<ParsedMessage, { ok: true }>,
  userId: string,
  source: "telegram" | "email",
  inboundId: string,
): Promise<{ reply: string; taskId: string | null; projectId: string | null }> {
  const fields = parsed.fields;
  if (parsed.mode === "update") {
    const number = fields["Номер"]!;
    const existing = await findNumber(client, number);
    if (!existing) throw new InputError({ number: `Номер ${number} не найден.` });
    if (existing.type !== parsed.type) {
      throw new InputError({ number: `Номер ${number} относится к другой записи.` });
    }
    if (parsed.type === "project") {
      const project = await patchProjectFields(client, number, fields, userId);
      const changed = changedLabels(fields);
      return {
        reply: intakeReply({
          created: false,
          updated: changed.length > 0,
          unchanged: changed.length === 0,
          kindLabel: "Проект",
          number: project.number,
          changed,
        }),
        taskId: null,
        projectId: project.id,
      };
    }
    const task = await patchTask(client, number, await taskPatchFromFields(client, parsed.type, fields), userId);
    const changed = changedLabels(fields);
    return {
      reply: intakeReply({
        created: false,
        updated: changed.length > 0,
        unchanged: changed.length === 0,
        kindLabel: parsed.type === "task" ? "Задача" : "Бэклог",
        number: task.number,
        changed,
      }),
      taskId: task.id,
      projectId: task.projectId,
    };
  }

  if (parsed.type === "project") {
    const product = await requireByName(client, "products", fields["Продукт"]!, "продукт");
    const customer = await requireByName(client, "clients", fields["Клиент"]!, "клиент");
    const team = await requireByName(client, "teams", fields["Команда"]!, "команда");
    const project = await insertProject(
      client,
      {
        name: fields["Название"]!,
        productId: product.id,
        clientId: customer.id,
        teamId: team.id,
        status: fields["Статус"] ? statusCode("project", fields["Статус"])! : "preparing",
        dueDate: parseUserDate(fields["Срок"]!),
        summary: fields["Описание"] ?? null,
        source,
        inboundId,
      },
      userId,
    );
    return {
      reply: intakeReply({
        created: true,
        updated: false,
        unchanged: false,
        kindLabel: "Проект",
        number: project.number,
        dueDate: project.dueDate,
      }),
      taskId: null,
      projectId: project.id,
    };
  }

  const task = await insertTask(client, await taskInputFromFields(client, parsed, source, inboundId), userId);
  return {
    reply: intakeReply({
      created: true,
      updated: false,
      unchanged: false,
      kindLabel: parsed.type === "task" ? "Задача" : "Бэклог",
      number: task.number,
      dueDate: task.dueDate,
      side: task.side,
    }),
    taskId: task.id,
    projectId: task.projectId,
  };
}

async function insertProject(client: PoolClient, input: ProjectInput, userId: string): Promise<ProjectCard> {
  const next = {
    name: input.name.trim(),
    productId: input.productId,
    clientId: input.clientId,
    teamId: input.teamId,
    status: input.status || "preparing",
    dueDate: emptyToNull(input.dueDate),
    summary: emptyToNull(input.summary ?? null),
    number: input.number?.trim() || (await allocate(client, "project", "P")),
  };
  assertProject(next);
  const rows = await txQuery<{ id: string }>(
    client,
    `INSERT INTO projects (number, name, product_id, client_id, team_id, status, due_date, summary, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [next.number, next.name, next.productId, next.clientId, next.teamId, next.status, next.dueDate, next.summary, userId],
  );
  await writeDiff(client, userId, "project", rows[0].id, {}, "create");
  if (input.inboundId) {
    await txQuery(client, "UPDATE inbound_messages SET project_id = $2 WHERE id = $1", [input.inboundId, rows[0].id]);
  }
  const cards = await listProjectsIn(client, {});
  return cards.find((item) => item.id === rows[0].id)!;
}

async function insertTask(client: PoolClient, input: TaskInput, userId: string): Promise<TaskCard> {
  const description = input.description.trim();
  if (!description) throw new InputError({ description: "Опишите задачу." });
  if (description.length > 20000) throw new InputError({ description: "Описание длиннее 20 тысяч знаков." });
  const person = await findOrCreatePerson(client, input.assigneeName);
  let projectId: string | null = null;
  let productId = input.productId ?? null;
  let clientId = input.clientId ?? null;
  let teamId = input.teamId ?? null;
  let side: string | null = null;
  let beneficiary: string | null = null;
  let status = input.status ?? null;
  const prefix = input.kind === "backlog" ? "B" : "T";
  const counter = input.kind === "backlog" ? "backlog" : "task";

  if (input.kind === "project_task") {
    const project = await txQuery<Record<string, unknown>>(
      client,
      "SELECT * FROM projects WHERE number = $1 OR name = $1 ORDER BY number LIMIT 1",
      [input.projectNumber?.trim() ?? ""],
    );
    if (!project[0]) throw new InputError({ project: `Проект «${input.projectNumber}» не найден.` });
    projectId = String(project[0].id);
    productId = String(project[0].product_id);
    clientId = String(project[0].client_id);
    teamId = teamId || String(project[0].team_id);
    side = input.side || null;
    if (!side || !SIDES.some((item) => item[0] === side)) throw new InputError({ side: "Укажите сторону: мы, клиент или партнёр." });
    status = status || "todo";
    const due = input.dueDate !== undefined ? emptyToNull(input.dueDate) : (project[0].due_date as string | null);
    input = { ...input, dueDate: due };
  } else {
    if (!productId) throw new InputError({ product: "Укажите продукт." });
    if (!teamId) throw new InputError({ team: "Укажите команду." });
    beneficiary = input.beneficiary || null;
    if (!beneficiary) throw new InputError({ beneficiary: "Укажите, для кого задача." });
    if (beneficiary === "client" && !clientId) throw new InputError({ client: "Укажите клиента." });
    if (beneficiary !== "client") clientId = null;
    side = null;
    status = status || "backlog";
  }

  const number = input.number?.trim() || (await allocate(client, counter, prefix));
  const rows = await txQuery<{ id: string }>(
    client,
    `INSERT INTO tasks (
      kind, number, description, external_number, project_id, product_id, team_id, person_id, client_id,
      beneficiary, side, status, due_date, source, inbound_message_id, created_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
    [
      input.kind,
      number,
      description,
      emptyToNull(input.externalNumber),
      projectId,
      productId,
      teamId,
      person.id,
      clientId,
      beneficiary,
      side,
      status,
      emptyToNull(input.dueDate),
      input.source ?? "manual",
      input.inboundId ?? null,
      userId,
    ],
  );
  await writeDiff(client, userId, "task", rows[0].id, {}, "create");
  return (await taskById(client, rows[0].id))!;
}

async function patchTask(client: PoolClient, number: string, patch: Partial<TaskInput>, userId: string): Promise<TaskCard> {
  const current = await taskByNumber(client, number);
  if (!current) throw new InputError({ number: "Задача не найдена." });
  const person = patch.assigneeName ? await findOrCreatePerson(client, patch.assigneeName) : { id: current.personId, name: current.assignee };
  const dueDate = patch.dueDate !== undefined ? emptyToNull(patch.dueDate) : current.dueDate;
  const today = moscowToday();
  const t14 = patch.dueDate !== undefined ? clearedT14Mark(dueDate, current.t14DueDate, today) : current.t14DueDate;
  const next = {
    description: patch.description?.trim() || current.description,
    externalNumber: patch.externalNumber !== undefined ? emptyToNull(patch.externalNumber) : current.externalNumber,
    teamId: patch.teamId || current.teamId,
    personId: person.id,
    status: patch.status || current.status,
    dueDate,
    side: current.kind === "backlog" ? null : patch.side || current.side,
    beneficiary: current.kind === "project_task" ? null : patch.beneficiary || current.beneficiary,
    clientId: current.kind === "project_task" ? current.clientId : patch.clientId !== undefined ? patch.clientId : current.clientId,
    productId: patch.productId || current.productId,
  };
  if (current.kind === "backlog" && next.beneficiary !== "client") next.clientId = null;
  if (current.kind === "backlog" && next.beneficiary === "client" && !next.clientId) {
    throw new InputError({ client: "Укажите клиента." });
  }
  await txQuery(
    client,
    `UPDATE tasks
     SET description = $2, external_number = $3, team_id = $4, person_id = $5, status = $6, due_date = $7,
         side = $8, beneficiary = $9, client_id = $10, product_id = $11, t14_due_date = $12, updated_at = now()
     WHERE id = $1`,
    [
      current.id,
      next.description,
      next.externalNumber,
      next.teamId,
      next.personId,
      next.status,
      next.dueDate,
      next.side,
      next.beneficiary,
      next.clientId,
      next.productId,
      t14,
    ],
  );
  const teamName =
    next.teamId === current.teamId
      ? current.teamName
      : (await txQuery<{ name: string }>(client, "SELECT name FROM teams WHERE id = $1", [next.teamId]))[0]?.name ?? current.teamName;
  const clientName =
    next.clientId === current.clientId
      ? current.clientName
      : next.clientId
        ? ((await txQuery<{ name: string }>(client, "SELECT name FROM clients WHERE id = $1", [next.clientId]))[0]?.name ?? null)
        : null;
  await writeDiff(client, userId, "task", current.id, {
    due_date: pair(current.dueDate, next.dueDate),
    status: pair(current.status, next.status),
    assignee: pair(current.assignee, person.name),
    side: pair(current.side ? label(SIDES, current.side) : null, next.side ? label(SIDES, next.side) : null),
    team: pair(current.teamName, teamName),
    beneficiary: pair(
      current.beneficiary ? label(BENEFICIARIES, current.beneficiary) : null,
      next.beneficiary ? label(BENEFICIARIES, next.beneficiary) : null,
    ),
    client: pair(current.clientName, clientName),
  });
  return (await taskByNumber(client, current.number))!;
}

async function patchProjectFields(
  client: PoolClient,
  number: string,
  fields: Extract<ParsedMessage, { ok: true }>["fields"],
  userId: string,
): Promise<ProjectCard> {
  const patch: Partial<ProjectInput> = {};
  if (fields["Название"]) patch.name = fields["Название"];
  if (fields["Продукт"]) patch.productId = (await requireByName(client, "products", fields["Продукт"], "продукт")).id;
  if (fields["Клиент"]) patch.clientId = (await requireByName(client, "clients", fields["Клиент"], "клиент")).id;
  if (fields["Команда"]) patch.teamId = (await requireByName(client, "teams", fields["Команда"], "команда")).id;
  if (fields["Срок"]) patch.dueDate = parseUserDate(fields["Срок"]);
  if (fields["Статус"]) patch.status = statusCode("project", fields["Статус"])!;
  if (fields["Описание"]) patch.summary = fields["Описание"];
  const current = await txQuery<{ id: string }>(client, "SELECT id FROM projects WHERE number = $1", [number]);
  if (!current[0]) throw new InputError({ number: "Проект не найден." });
  const row = await txQuery<Record<string, unknown>>(client, "SELECT * FROM projects WHERE id = $1", [current[0].id]);
  const existing = row[0];
  const next = {
    number,
    name: patch.name ?? String(existing.name),
    productId: patch.productId ?? String(existing.product_id),
    clientId: patch.clientId ?? String(existing.client_id),
    teamId: patch.teamId ?? String(existing.team_id),
    status: patch.status ?? String(existing.status),
    dueDate: patch.dueDate !== undefined ? patch.dueDate : (existing.due_date as string | null),
    summary: patch.summary !== undefined ? patch.summary : (existing.summary as string | null),
  };
  assertProject(next);
  await txQuery(
    client,
    `UPDATE projects SET name=$2, product_id=$3, client_id=$4, team_id=$5, status=$6, due_date=$7, summary=$8, updated_at=now() WHERE id=$1`,
    [existing.id, next.name, next.productId, next.clientId, next.teamId, next.status, next.dueDate, next.summary],
  );
  await txQuery(client, "UPDATE tasks SET product_id=$2, client_id=$3, updated_at=now() WHERE project_id=$1", [
    existing.id,
    next.productId,
    next.clientId,
  ]);
  const cards = await listProjectsIn(client, {});
  return cards.find((item) => item.id === existing.id)!;
}

async function taskInputFromFields(
  client: PoolClient,
  parsed: Extract<ParsedMessage, { ok: true }>,
  source: "telegram" | "email",
  inboundId: string,
): Promise<TaskInput> {
  const fields = parsed.fields;
  if (parsed.type === "task") {
    const project = await txQuery<Record<string, unknown>>(
      client,
      "SELECT number, team_id, due_date FROM projects WHERE number = $1 OR name = $1",
      [fields["Проект"]],
    );
    if (!project[0]) throw new InputError({ project: `Проект «${fields["Проект"]}» не найден.` });
    const team = fields["Команда"]
      ? await requireByName(client, "teams", fields["Команда"], "команда")
      : { id: String(project[0].team_id) };
    return {
      kind: "project_task",
      projectNumber: String(project[0].number),
      description: fields["Описание"]!,
      assigneeName: fields["Ответственный"]!,
      side: statusSide(fields["Сторона"]!),
      teamId: team.id,
      status: fields["Статус"] ? statusCode("task", fields["Статус"]) : "todo",
      dueDate: fields["Срок"] ? parseUserDate(fields["Срок"]) : (project[0].due_date as string | null),
      externalNumber: fields["Внешний номер"] ?? null,
      source,
      inboundId,
    };
  }
  const product = await requireByName(client, "products", fields["Продукт"]!, "продукт");
  const team = await requireByName(client, "teams", fields["Команда"]!, "команда");
  const beneficiary = canonicalBeneficiary(fields["Для кого"]!);
  const customer =
    beneficiary === "client" ? await requireByName(client, "clients", fields["Для кого"]!, "клиент") : null;
  return {
    kind: "backlog",
    productId: product.id,
    teamId: team.id,
    description: fields["Описание"]!,
    assigneeName: fields["Ответственный"]!,
    beneficiary,
    clientId: customer?.id ?? null,
    status: fields["Статус"] ? statusCode("backlog", fields["Статус"]) : "backlog",
    dueDate: parseUserDate(fields["Срок"]!),
    externalNumber: fields["Внешний номер"] ?? null,
    source,
    inboundId,
  };
}

async function taskPatchFromFields(
  client: PoolClient,
  type: RecordType,
  fields: Extract<ParsedMessage, { ok: true }>["fields"],
): Promise<Partial<TaskInput>> {
  const patch: Partial<TaskInput> = {};
  if (fields["Описание"]) patch.description = fields["Описание"];
  if (fields["Ответственный"]) patch.assigneeName = fields["Ответственный"];
  if (fields["Команда"]) patch.teamId = (await requireByName(client, "teams", fields["Команда"], "команда")).id;
  if (fields["Срок"]) patch.dueDate = parseUserDate(fields["Срок"]);
  if (fields["Статус"]) patch.status = statusCode(type, fields["Статус"]);
  if (fields["Внешний номер"]) patch.externalNumber = fields["Внешний номер"];
  if (fields["Сторона"]) patch.side = statusSide(fields["Сторона"]);
  if (fields["Продукт"]) patch.productId = (await requireByName(client, "products", fields["Продукт"], "продукт")).id;
  if (fields["Для кого"]) {
    const beneficiary = canonicalBeneficiary(fields["Для кого"]);
    patch.beneficiary = beneficiary;
    patch.clientId =
      beneficiary === "client" ? (await requireByName(client, "clients", fields["Для кого"], "клиент")).id : null;
  }
  return patch;
}

async function requireByName(
  client: PoolClient,
  kind: "products" | "clients" | "teams",
  name: string,
  title: string,
): Promise<{ id: string; name: string }> {
  const found = await findActiveByName(client, kind, name);
  if (found) return found;
  const suggestions = await suggestNames(kind, name);
  const hint = suggestions.length ? ` Похожие: ${suggestions.join(", ")}.` : "";
  throw new InputError({ [kind]: `Не найден ${title} «${name}».${hint}` });
}

function statusSide(value: string): string {
  const code = SIDES.find((item) => item[1].toLowerCase() === value.trim().toLowerCase())?.[0];
  if (!code) throw new InputError({ side: `Неизвестная сторона «${value}».` });
  return code;
}

async function findNumber(client: PoolClient, number: string): Promise<{ type: RecordType } | null> {
  const task = await txQuery<{ kind: string }>(client, "SELECT kind FROM tasks WHERE number = $1", [number]);
  if (task[0]) return { type: task[0].kind === "backlog" ? "backlog" : "task" };
  const project = await txQuery(client, "SELECT id FROM projects WHERE number = $1", [number]);
  if (project[0]) return { type: "project" };
  return null;
}

async function allocate(client: PoolClient, name: "project" | "task" | "backlog", prefix: string): Promise<string> {
  const rows = await txQuery<{ value: number }>(
    client,
    "UPDATE counters SET value = value + 1 WHERE name = $1 RETURNING value",
    [name],
  );
  return `${prefix}-${String(rows[0].value).padStart(4, "0")}`;
}

async function taskById(client: PoolClient, id: string): Promise<TaskCard | null> {
  const today = moscowToday();
  const rows = await txQuery<Record<string, unknown>>(client, `${TASK_SELECT} WHERE t.id = $2`, [today, id]);
  return rows[0] ? mapTask(rows[0]) : null;
}

async function taskByNumber(client: PoolClient, number: string): Promise<TaskCard | null> {
  const today = moscowToday();
  const rows = await txQuery<Record<string, unknown>>(client, `${TASK_SELECT} WHERE t.number = $2`, [today, number]);
  return rows[0] ? mapTask(rows[0]) : null;
}

async function listProjectsIn(client: PoolClient, filters: Filters): Promise<ProjectCard[]> {
  const today = moscowToday();
  const rows = await txQuery<Record<string, unknown>>(
    client,
    `SELECT p.id, p.number, p.name, p.product_id, pr.name AS product_name, p.client_id, c.name AS client_name,
            p.team_id, tm.name AS team_name, p.status, p.due_date, p.summary,
            work_attention('todo', p.status, p.due_date, $1::date) AS self_attention,
            0::int AS open_count, 0::int AS client_side_count, NULL::date AS nearest_due, NULL::int AS task_rank
     FROM projects p
     JOIN products pr ON pr.id = p.product_id
     JOIN clients c ON c.id = p.client_id
     JOIN teams tm ON tm.id = p.team_id
     WHERE ($2::uuid IS NULL OR p.team_id = $2)
       AND ($3::uuid IS NULL OR p.product_id = $3)
       AND ($4::uuid IS NULL OR p.client_id = $4)
       AND ($5::date IS NULL OR (p.due_date IS NOT NULL AND p.due_date <= $5))`,
    [today, filters.teamId ?? null, filters.productId ?? null, filters.clientId ?? null, filters.dueOnOrBefore ?? null],
  );
  return rows.map(mapProject);
}

function assertProject(input: { name: string; status: string; number: string }): void {
  if (!input.name.trim()) throw new InputError({ name: "Укажите название проекта." });
  if (!statusCode("project", labelFromProject(input.status)) && !["draft", "preparing", "active", "paused", "launched", "cancelled"].includes(input.status)) {
    throw new InputError({ status: "Неизвестный статус проекта." });
  }
  if (!input.number.trim()) throw new InputError({ number: "Укажите номер." });
}

function labelFromProject(status: string): string {
  return status;
}

async function writeDiff(
  client: PoolClient,
  actorId: string,
  entityType: string,
  entityId: string,
  diff: Record<string, { from: string | null; to: string | null } | null>,
  action = "update",
): Promise<void> {
  const changed: Record<string, { from: string | null; to: string | null }> = {};
  for (const [key, value] of Object.entries(diff)) {
    if (!value || value.from === value.to) continue;
    if (value.from === null && value.to === null) continue;
    changed[key] = { from: value.from, to: value.to };
  }
  if (action === "update" && !Object.keys(changed).length) return;
  await txQuery(
    client,
    "INSERT INTO activity_log (actor_id, entity_type, entity_id, action, diff) VALUES ($1,$2,$3,$4,$5::jsonb)",
    [actorId, entityType, entityId, action, JSON.stringify(changed)],
  );
}

function pair(from: unknown, to: unknown): { from: string | null; to: string | null } {
  return { from: from == null || from === "" ? null : String(from), to: to == null || to === "" ? null : String(to) };
}

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function changedLabels(fields: Record<string, string | undefined>): string[] {
  return Object.keys(fields).filter((key) => key !== "Номер");
}

function mapProject(row: Record<string, unknown>): ProjectCard {
  const self = String(row.self_attention) as Attention;
  const rank = row.task_rank == null ? null : Number(row.task_rank);
  const fromRank: Attention | null = rank == null ? null : (["overdue", "soon", "undated", "ok"][rank] as Attention);
  return {
    id: String(row.id),
    number: String(row.number),
    name: String(row.name),
    productId: String(row.product_id),
    productName: String(row.product_name),
    clientId: String(row.client_id),
    clientName: String(row.client_name),
    teamId: String(row.team_id),
    teamName: String(row.team_name),
    status: String(row.status),
    dueDate: (row.due_date as string | null) ?? null,
    summary: (row.summary as string | null) ?? null,
    openCount: Number(row.open_count ?? 0),
    clientSideCount: Number(row.client_side_count ?? 0),
    nearestDue: (row.nearest_due as string | null) ?? null,
    attention: worse(self, fromRank),
  };
}

function mapTask(row: Record<string, unknown>): TaskCard {
  return {
    id: String(row.id),
    kind: row.kind as TaskCard["kind"],
    number: String(row.number),
    description: String(row.description),
    externalNumber: (row.external_number as string | null) ?? null,
    projectId: (row.project_id as string | null) ?? null,
    projectNumber: (row.project_number as string | null) ?? null,
    projectName: (row.project_name as string | null) ?? null,
    projectStatus: (row.project_status as string | null) ?? null,
    productId: String(row.product_id),
    productName: String(row.product_name),
    teamId: String(row.team_id),
    teamName: String(row.team_name),
    personId: String(row.person_id),
    assignee: String(row.assignee),
    clientId: (row.client_id as string | null) ?? null,
    clientName: (row.client_name as string | null) ?? null,
    beneficiary: (row.beneficiary as string | null) ?? null,
    side: (row.side as string | null) ?? null,
    status: String(row.status),
    dueDate: (row.due_date as string | null) ?? null,
    t14DueDate: (row.t14_due_date as string | null) ?? null,
    source: String(row.source),
    inboundMessageId: (row.inbound_message_id as string | null) ?? null,
    attention: String(row.attention) as Attention,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function worse(left: Attention, right: Attention | null): Attention {
  const rank: Record<Attention, number> = { overdue: 0, soon: 1, undated: 2, ok: 3, closed: 4 };
  if (!right) return left;
  return rank[right] < rank[left] ? right : left;
}

export async function resetBusinessData(): Promise<void> {
  const { query } = await import("../db/pool");
  await query(
    `TRUNCATE alert_deliveries, activity_log, tasks, projects, inbound_messages, people, products, teams, clients RESTART IDENTITY CASCADE`,
  );
  await query("UPDATE counters SET value = 0");
  await query("INSERT INTO clients (name) VALUES ('Внутренний')");
}
