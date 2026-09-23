CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY DEFAULT (gen_random_uuid()),
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  telegram_user_id text,
  telegram_chat_id text,
  is_active integer NOT NULL DEFAULT 1,
  created_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE IF NOT EXISTS products (
  id text PRIMARY KEY DEFAULT (gen_random_uuid()),
  name text NOT NULL,
  archived_at text
);

CREATE UNIQUE INDEX IF NOT EXISTS products_name_unique ON products (lower(trim(name)));

CREATE TABLE IF NOT EXISTS clients (
  id text PRIMARY KEY DEFAULT (gen_random_uuid()),
  name text NOT NULL,
  archived_at text
);

CREATE UNIQUE INDEX IF NOT EXISTS clients_name_unique ON clients (lower(trim(name)));

CREATE TABLE IF NOT EXISTS teams (
  id text PRIMARY KEY DEFAULT (gen_random_uuid()),
  name text NOT NULL,
  archived_at text
);

CREATE UNIQUE INDEX IF NOT EXISTS teams_name_unique ON teams (lower(trim(name)));

CREATE TABLE IF NOT EXISTS people (
  id text PRIMARY KEY DEFAULT (gen_random_uuid()),
  name text NOT NULL,
  team_id text REFERENCES teams (id),
  archived_at text
);

CREATE UNIQUE INDEX IF NOT EXISTS people_name_unique ON people (lower(trim(name)));

CREATE TABLE IF NOT EXISTS projects (
  id text PRIMARY KEY DEFAULT (gen_random_uuid()),
  number text NOT NULL UNIQUE,
  name text NOT NULL,
  product_id text NOT NULL REFERENCES products (id),
  client_id text NOT NULL REFERENCES clients (id),
  team_id text NOT NULL REFERENCES teams (id),
  status text NOT NULL CHECK (status IN ('draft', 'preparing', 'active', 'paused', 'launched', 'cancelled')),
  due_date text,
  summary text,
  created_by text NOT NULL REFERENCES users (id),
  created_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE INDEX IF NOT EXISTS projects_team_idx ON projects (team_id);
CREATE INDEX IF NOT EXISTS projects_product_idx ON projects (product_id);
CREATE INDEX IF NOT EXISTS projects_client_idx ON projects (client_id);
CREATE INDEX IF NOT EXISTS projects_due_idx ON projects (due_date);

CREATE TABLE IF NOT EXISTS tasks (
  id text PRIMARY KEY DEFAULT (gen_random_uuid()),
  kind text NOT NULL CHECK (kind IN ('project_task', 'backlog')),
  number text NOT NULL UNIQUE,
  description text NOT NULL,
  external_number text,
  project_id text REFERENCES projects (id),
  product_id text NOT NULL REFERENCES products (id),
  team_id text NOT NULL REFERENCES teams (id),
  person_id text NOT NULL REFERENCES people (id),
  client_id text REFERENCES clients (id),
  beneficiary text CHECK (beneficiary IN ('client', 'all_clients', 'internal')),
  side text CHECK (side IN ('ours', 'client', 'partner')),
  status text NOT NULL,
  due_date text,
  t14_due_date text,
  source text NOT NULL CHECK (source IN ('manual', 'telegram', 'email')),
  inbound_message_id text,
  created_by text NOT NULL REFERENCES users (id),
  created_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
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
  id text PRIMARY KEY DEFAULT (gen_random_uuid()),
  channel text NOT NULL CHECK (channel IN ('telegram', 'email')),
  external_id text NOT NULL,
  sender text NOT NULL,
  raw_text text NOT NULL,
  received_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  parse_status text NOT NULL CHECK (parse_status IN ('applied', 'needs_review', 'rejected', 'duplicate')),
  parse_error text,
  parsed_json text,
  task_id text REFERENCES tasks (id),
  project_id text REFERENCES projects (id),
  reply text,
  UNIQUE (channel, external_id)
);

CREATE TABLE IF NOT EXISTS alert_deliveries (
  id text PRIMARY KEY DEFAULT (gen_random_uuid()),
  kind text NOT NULL CHECK (kind IN ('t14', 'digest')),
  task_id text REFERENCES tasks (id),
  digest_date text,
  payload text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  error text,
  created_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  sent_at text
);

CREATE UNIQUE INDEX IF NOT EXISTS alert_digest_day_unique
  ON alert_deliveries (digest_date)
  WHERE kind = 'digest';

CREATE TABLE IF NOT EXISTS activity_log (
  id text PRIMARY KEY DEFAULT (gen_random_uuid()),
  actor_id text REFERENCES users (id),
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  action text NOT NULL,
  diff text NOT NULL,
  created_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE INDEX IF NOT EXISTS activity_entity_idx ON activity_log (entity_type, entity_id, created_at);

CREATE TABLE IF NOT EXISTS counters (
  name text PRIMARY KEY,
  value integer NOT NULL
);

INSERT INTO counters (name, value)
VALUES ('project', 0), ('task', 0), ('backlog', 0)
ON CONFLICT (name) DO NOTHING;

INSERT INTO clients (name)
VALUES ('Внутренний')
ON CONFLICT (lower(trim(name))) DO NOTHING;
