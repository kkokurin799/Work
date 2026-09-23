import { moscowToday } from "../domain/dates";
import { query } from "../db/pool";
import { listTasks, type Filters, type TaskCard } from "./records";

export type Overview = {
  projectsLive: number;
  clientSide: number;
  soon: number;
  overdue: number;
  inSprint: number;
  undated: number;
  inbox: number;
  failedDeliveries: number;
  lastDigestAt: string | null;
  attention: TaskCard[];
};

export async function overview(filters: Filters): Promise<Overview> {
  const today = moscowToday();
  const rows = await query<{
    projects_live: string;
    undated_projects: string;
    undated_tasks: string;
    inbox: string;
    failed: string;
    last_digest: string | null;
  }>(
    `SELECT
      (SELECT count(*) FROM projects p
        WHERE p.status IN ('preparing', 'active')
          AND ($2::uuid IS NULL OR p.team_id = $2)
          AND ($3::uuid IS NULL OR p.product_id = $3)
          AND ($4::uuid IS NULL OR p.client_id = $4)
          AND ($5::date IS NULL OR (p.due_date IS NOT NULL AND p.due_date <= $5))) AS projects_live,
      (SELECT count(*) FROM projects p
        WHERE p.status NOT IN ('paused', 'launched', 'cancelled')
          AND p.due_date IS NULL
          AND ($2::uuid IS NULL OR p.team_id = $2)
          AND ($3::uuid IS NULL OR p.product_id = $3)
          AND ($4::uuid IS NULL OR p.client_id = $4)) AS undated_projects,
      (SELECT count(*) FROM tasks t
        LEFT JOIN projects p ON p.id = t.project_id
        WHERE work_attention(t.status, p.status, t.due_date, $1::date) = 'undated'
          AND ($2::uuid IS NULL OR t.team_id = $2)
          AND ($3::uuid IS NULL OR t.product_id = $3)
          AND (
            $4::uuid IS NULL
            OR (t.kind = 'project_task' AND t.client_id = $4)
            OR (t.kind = 'backlog' AND (t.beneficiary = 'all_clients' OR (t.beneficiary = 'client' AND t.client_id = $4)))
          )) AS undated_tasks,
      (SELECT count(*) FROM inbound_messages WHERE parse_status = 'needs_review') AS inbox,
      (SELECT count(*) FROM alert_deliveries WHERE status = 'failed' AND created_at > now() - interval '1 day') AS failed,
      (SELECT max(sent_at) FROM alert_deliveries WHERE kind = 'digest' AND status = 'sent') AS last_digest`,
    [today, filters.teamId ?? null, filters.productId ?? null, filters.clientId ?? null, filters.dueOnOrBefore ?? null],
  );
  const [soon, overdue, inSprint, clientSide, attention] = await Promise.all([
    listTasks({ ...filters, attention: "soon", limit: 500 }),
    listTasks({ ...filters, attention: "overdue", limit: 500 }),
    listTasks({ ...filters, kind: "backlog", status: "in_sprint", limit: 500 }),
    listTasks({ ...filters, kind: "project_task", side: "client", limit: 500 }).then((rows) =>
      rows.filter((row) => row.status !== "done" && row.status !== "cancelled"),
    ),
    listTasks({ ...filters, hot: true, limit: 15 }),
  ]);
  const row = rows[0];
  return {
    projectsLive: Number(row.projects_live),
    clientSide: clientSide.length,
    soon: soon.length,
    overdue: overdue.length,
    inSprint: inSprint.length,
    undated: Number(row.undated_projects) + Number(row.undated_tasks),
    inbox: Number(row.inbox),
    failedDeliveries: Number(row.failed),
    lastDigestAt: row.last_digest,
    attention,
  };
}
