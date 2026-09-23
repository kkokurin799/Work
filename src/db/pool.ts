import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { attention } from "../domain/attention";

export type DbClient = {
  query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
};

type SqliteStatement = {
  all(...params: unknown[]): Record<string, unknown>[];
  run(...params: unknown[]): unknown;
};

type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  function(name: string, fn: (...args: unknown[]) => unknown): void;
  close(): void;
};

const storage = new AsyncLocalStorage<DbClient>();

const globalForDb = globalThis as typeof globalThis & {
  workSqlite?: SqliteDatabase;
  workSqliteQueue?: Promise<void>;
};

export function databasePath(): string {
  const configured = process.env.SQLITE_PATH?.trim();
  return configured || path.join(process.cwd(), "data", "work.db");
}

async function openDb(): Promise<SqliteDatabase> {
  if (globalForDb.workSqlite) return globalForDb.workSqlite;
  let DatabaseSync: new (filename: string) => SqliteDatabase;
  try {
    const loaded = (await import(/* webpackIgnore: true */ "node:sqlite")) as {
      DatabaseSync: new (filename: string) => SqliteDatabase;
    };
    DatabaseSync = loaded.DatabaseSync;
  } catch {
    throw new Error(
      "Встроенный SQLite недоступен. Нужен Node.js 22.5 или новее. Запускайте команды через npm: в скриптах уже стоит флаг --experimental-sqlite.",
    );
  }
  const file = databasePath();
  if (file !== ":memory:") fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON");
  if (file !== ":memory:") db.exec("PRAGMA journal_mode = WAL");
  db.function("gen_random_uuid", () => randomUUID());
  db.function("work_attention", (taskStatus: unknown, projectStatus: unknown, dueDate: unknown, today: unknown) =>
    attention({
      taskStatus: String(taskStatus ?? ""),
      projectStatus: projectStatus == null ? null : String(projectStatus),
      dueDate: dueDate == null ? null : String(dueDate),
      today: String(today ?? ""),
    }),
  );
  globalForDb.workSqlite = db;
  return db;
}

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const previous = globalForDb.workSqliteQueue ?? Promise.resolve();
  const run = previous.then(fn, fn);
  globalForDb.workSqliteQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function translateSql(text: string, params: unknown[]): { sql: string; values: unknown[] } {
  const values: unknown[] = [];
  const sql = text
    .replace(/\bbtrim\s*\(/gi, "trim(")
    .replace(/\bnow\s*\(\s*\)/gi, "strftime('%Y-%m-%dT%H:%M:%SZ','now')")
    .replace(/::(uuid|date|boolean|int|integer|text|jsonb|timestamptz)\b/gi, "")
    .replace(/\$(\d+)/g, (_match, index: string) => {
      const value = params[Number(index) - 1];
      values.push(value === undefined ? null : typeof value === "boolean" ? (value ? 1 : 0) : value);
      return "?";
    });
  return { sql, values };
}

function returnsRows(sql: string): boolean {
  const head = sql.trimStart();
  return /^(select|with)\b/i.test(head) || /\breturning\b/i.test(sql);
}

function runSync(db: SqliteDatabase, text: string, params: unknown[] = []): Record<string, unknown>[] {
  const { sql, values } = translateSql(text, params);
  const statement = db.prepare(sql);
  if (returnsRows(sql)) return statement.all(...values);
  statement.run(...values);
  return [];
}

export async function query<T>(text: string, params: unknown[] = []): Promise<T[]> {
  const current = storage.getStore();
  if (current) {
    const result = await current.query(text, params);
    return result.rows as T[];
  }
  return enqueue(async () => {
    const db = await openDb();
    return runSync(db, text, params) as T[];
  });
}

export async function withTx<T>(fn: (client: DbClient) => Promise<T>): Promise<T> {
  const existing = storage.getStore();
  if (existing) return fn(existing);
  return enqueue(async () => {
    const db = await openDb();
    const client: DbClient = {
      query: async (text, params = []) => ({ rows: runSync(db, text, params) }),
    };
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = await storage.run(client, () => fn(client));
      db.exec("COMMIT");
      return result;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  });
}

export async function txQuery<T>(client: DbClient, text: string, params: unknown[] = []): Promise<T[]> {
  const result = await client.query(text, params);
  return result.rows as T[];
}

export async function execScript(sql: string): Promise<void> {
  await enqueue(async () => {
    const db = await openDb();
    db.exec(sql);
  });
}

export async function vacuumInto(file: string): Promise<void> {
  await enqueue(async () => {
    const db = await openDb();
    db.exec(`VACUUM INTO '${file.replaceAll("'", "''")}'`);
  });
}

export function getPool(): { end(): Promise<void> } {
  return { end: closeDb };
}

export async function closeDb(): Promise<void> {
  await enqueue(async () => {
    const db = globalForDb.workSqlite;
    if (!db) return;
    db.close();
    globalForDb.workSqlite = undefined;
  });
}
