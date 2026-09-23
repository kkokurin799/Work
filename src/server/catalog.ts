import { query, txQuery, withTx, type DbClient } from "../db/pool";
import { InputError } from "./errors";

export type CatalogKind = "products" | "clients" | "teams";

export type NamedRow = { id: string; name: string; archivedAt: string | null };
export type PersonRow = NamedRow & { teamId: string | null; teamName: string | null };

const TABLES: Record<CatalogKind, string> = {
  products: "products",
  clients: "clients",
  teams: "teams",
};

export async function listCatalog(kind: CatalogKind, includeArchived = false): Promise<NamedRow[]> {
  const table = TABLES[kind];
  const rows = await query<{ id: string; name: string; archived_at: string | null }>(
    `SELECT id, name, archived_at FROM ${table} WHERE ($1::boolean OR archived_at IS NULL) ORDER BY lower(name)`,
    [includeArchived],
  );
  return rows.map((row) => ({ id: row.id, name: row.name, archivedAt: row.archived_at }));
}

export async function createCatalog(kind: CatalogKind, name: string): Promise<NamedRow> {
  const trimmed = cleanName(name);
  try {
    const rows = await query<{ id: string; name: string }>(
      `INSERT INTO ${TABLES[kind]} (name) VALUES ($1) RETURNING id, name`,
      [trimmed],
    );
    return { id: rows[0].id, name: rows[0].name, archivedAt: null };
  } catch (error) {
    rethrowUnique(error, "Такое имя уже есть в справочнике.");
  }
}

export async function updateCatalog(kind: CatalogKind, id: string, input: { name?: string; archived?: boolean }): Promise<void> {
  if (input.name !== undefined) {
    try {
      const rows = await query(`UPDATE ${TABLES[kind]} SET name = $2 WHERE id = $1 RETURNING id`, [
        id,
        cleanName(input.name),
      ]);
      if (!rows.length) throw new InputError({ name: "Запись справочника не найдена." });
    } catch (error) {
      if (error instanceof InputError) throw error;
      rethrowUnique(error, "Такое имя уже есть в справочнике.");
    }
  }
  if (input.archived !== undefined) {
    await query(`UPDATE ${TABLES[kind]} SET archived_at = CASE WHEN $2 THEN now() ELSE NULL END WHERE id = $1`, [
      id,
      input.archived,
    ]);
  }
}

export async function listPeople(includeArchived = false): Promise<PersonRow[]> {
  const rows = await query<{
    id: string;
    name: string;
    team_id: string | null;
    team_name: string | null;
    archived_at: string | null;
  }>(
    `SELECT p.id, p.name, p.team_id, t.name AS team_name, p.archived_at
     FROM people p
     LEFT JOIN teams t ON t.id = p.team_id
     WHERE ($1::boolean OR p.archived_at IS NULL)
     ORDER BY lower(p.name)`,
    [includeArchived],
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    teamId: row.team_id,
    teamName: row.team_name,
    archivedAt: row.archived_at,
  }));
}

export async function createPerson(name: string, teamId: string | null): Promise<PersonRow> {
  const trimmed = cleanName(name);
  try {
    const rows = await query<{ id: string }>(
      "INSERT INTO people (name, team_id) VALUES ($1, $2) RETURNING id",
      [trimmed, teamId],
    );
    return { id: rows[0].id, name: trimmed, teamId, teamName: null, archivedAt: null };
  } catch (error) {
    rethrowUnique(error, "Человек с таким именем уже есть.");
  }
}

export async function updatePerson(id: string, input: { name?: string; teamId?: string | null; archived?: boolean }): Promise<void> {
  if (input.name !== undefined || input.teamId !== undefined) {
    try {
      await query(
        `UPDATE people
         SET name = COALESCE($2, name),
             team_id = CASE WHEN $3::boolean THEN $4::uuid ELSE team_id END
         WHERE id = $1`,
        [id, input.name ? cleanName(input.name) : null, input.teamId !== undefined, input.teamId ?? null],
      );
    } catch (error) {
      rethrowUnique(error, "Человек с таким именем уже есть.");
    }
  }
  if (input.archived !== undefined) {
    await query("UPDATE people SET archived_at = CASE WHEN $2 THEN now() ELSE NULL END WHERE id = $1", [
      id,
      input.archived,
    ]);
  }
}

export async function findOrCreatePerson(client: DbClient, name: string): Promise<{ id: string; name: string }> {
  const trimmed = cleanName(name);
  const found = await txQuery<{ id: string; name: string }>(
    client,
    "SELECT id, name FROM people WHERE lower(btrim(name)) = lower(btrim($1))",
    [trimmed],
  );
  if (found[0]) {
    await txQuery(client, "UPDATE people SET archived_at = NULL WHERE id = $1", [found[0].id]);
    return found[0];
  }
  const created = await txQuery<{ id: string; name: string }>(
    client,
    "INSERT INTO people (name) VALUES ($1) RETURNING id, name",
    [trimmed],
  );
  return created[0];
}

export async function findActiveByName(
  client: DbClient,
  kind: CatalogKind,
  name: string,
): Promise<{ id: string; name: string } | null> {
  const rows = await txQuery<{ id: string; name: string }>(
    client,
    `SELECT id, name FROM ${TABLES[kind]} WHERE lower(btrim(name)) = lower(btrim($1)) AND archived_at IS NULL`,
    [name],
  );
  return rows[0] ?? null;
}

export async function suggestNames(kind: CatalogKind, queryText: string): Promise<string[]> {
  const rows = await query<{ name: string }>(
    `SELECT name FROM ${TABLES[kind]} WHERE archived_at IS NULL ORDER BY lower(name) LIMIT 8`,
  );
  const needle = queryText.trim().toLowerCase();
  const close = rows.filter((row) => row.name.toLowerCase().includes(needle.slice(0, 3))).map((row) => row.name);
  return (close.length ? close : rows.map((row) => row.name)).slice(0, 3);
}

export function cleanName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed) throw new InputError({ name: "Укажите имя." });
  if (trimmed.length > 200) throw new InputError({ name: "Имя длиннее 200 знаков." });
  return trimmed;
}

export async function withCatalogTx<T>(fn: (client: DbClient) => Promise<T>): Promise<T> {
  return withTx(fn);
}

function rethrowUnique(error: unknown, message: string): never {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  const text = error instanceof Error ? error.message : "";
  if (code === "23505" || /UNIQUE constraint failed/i.test(text)) {
    throw new InputError({ name: message });
  }
  throw error;
}
