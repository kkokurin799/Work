CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  telegram_user_id text,
  telegram_chat_id text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  archived_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS products_name_unique ON products (lower(btrim(name)));

CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  archived_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS clients_name_unique ON clients (lower(btrim(name)));

CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  archived_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS teams_name_unique ON teams (lower(btrim(name)));

CREATE TABLE IF NOT EXISTS people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  team_id uuid REFERENCES teams (id),
  archived_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS people_name_unique ON people (lower(btrim(name)));

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE,
  name text NOT NULL,
  product_id uuid NOT NULL REFERENCES products (id),
  client_id uuid NOT NULL REFERENCES clients (id),
  team_id uuid NOT NULL REFERENCES teams (id),
  status text NOT NULL CHECK (status IN ('draft', 'preparing', 'active', 'paused', 'launched', 'cancelled')),
  due_date date,
  summary text,
  created_by uuid NOT NULL REFERENCES users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS projects_team_idx ON projects (team_id);
CREATE INDEX IF NOT EXISTS projects_product_idx ON projects (product_id);
CREATE INDEX IF NOT EXISTS projects_client_idx ON projects (client_id);
CREATE INDEX IF NOT EXISTS projects_due_idx ON projects (due_date);

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('project_task', 'backlog')),
  number text NOT NULL UNIQUE,
  description text NOT NULL,
  external_number text,
  project_id uuid REFERENCES projects (id),
  product_id uuid NOT NULL REFERENCES products (id),
  team_id uuid NOT NULL REFERENCES teams (id),
  person_id uuid NOT NULL REFERENCES people (id),
  client_id uuid REFERENCES clients (id),
  beneficiary text CHECK (beneficiary IN ('client', 'all_clients', 'internal')),
  side text CHECK (side IN ('ours', 'client', 'partner')),
  status text NOT NULL,
  due_date date,
  t14_due_date date,
  source text NOT NULL CHECK (source IN ('manual', 'telegram', 'email')),
  inbound_message_id uuid,
  created_by uuid NOT NULL REFERENCES users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tasks_kind_fields CHECK (
    (
      kind = 'project_task'
      AND project_id IS NOT NULL
      AND side IS NOT NULL
      AND beneficiary IS NULL
      AND status IN ('todo', 'in_progress', 'waiting', 'done', 'cancelled')
    )
    OR (
      kind = 'backlog'
      AND project_id IS NULL
      AND side IS NULL
      AND beneficiary IS NOT NULL
      AND status IN ('backlog', 'in_sprint', 'done', 'cancelled')
      AND (beneficiary <> 'client' OR client_id IS NOT NULL)
    )
  )
);

CREATE INDEX IF NOT EXISTS tasks_kind_status_idx ON tasks (kind, status);
CREATE INDEX IF NOT EXISTS tasks_team_idx ON tasks (team_id);
CREATE INDEX IF NOT EXISTS tasks_product_idx ON tasks (product_id);
CREATE INDEX IF NOT EXISTS tasks_client_idx ON tasks (client_id);
CREATE INDEX IF NOT EXISTS tasks_due_idx ON tasks (due_date);
CREATE INDEX IF NOT EXISTS tasks_project_idx ON tasks (project_id);

CREATE TABLE IF NOT EXISTS inbound_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL CHECK (channel IN ('telegram', 'email')),
  external_id text NOT NULL,
  sender text NOT NULL,
  raw_text text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  parse_status text NOT NULL CHECK (parse_status IN ('applied', 'needs_review', 'rejected', 'duplicate')),
  parse_error text,
  parsed_json jsonb,
  task_id uuid REFERENCES tasks (id),
  project_id uuid REFERENCES projects (id),
  reply text,
  UNIQUE (channel, external_id)
);

CREATE TABLE IF NOT EXISTS alert_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('t14', 'digest')),
  task_id uuid REFERENCES tasks (id),
  digest_date date,
  payload text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS alert_digest_day_unique
  ON alert_deliveries (digest_date)
  WHERE kind = 'digest';

CREATE TABLE IF NOT EXISTS activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES users (id),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  diff jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_entity_idx ON activity_log (entity_type, entity_id, created_at);

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_inbound_fk;
ALTER TABLE tasks
  ADD CONSTRAINT tasks_inbound_fk FOREIGN KEY (inbound_message_id) REFERENCES inbound_messages (id);

CREATE TABLE IF NOT EXISTS counters (
  name text PRIMARY KEY,
  value integer NOT NULL
);

INSERT INTO counters (name, value)
VALUES ('project', 0), ('task', 0), ('backlog', 0)
ON CONFLICT (name) DO NOTHING;

INSERT INTO clients (name)
VALUES ('Внутренний')
ON CONFLICT ((lower(btrim(name)))) DO NOTHING;

CREATE OR REPLACE FUNCTION work_attention(
  task_status text,
  project_status text,
  due_date date,
  today date
) RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN task_status IN ('done', 'cancelled') THEN 'closed'
    WHEN project_status IN ('paused', 'launched', 'cancelled') THEN 'closed'
    WHEN due_date IS NULL THEN 'undated'
    WHEN due_date < today THEN 'overdue'
    WHEN due_date <= today + 14 THEN 'soon'
    ELSE 'ok'
  END
$$;
