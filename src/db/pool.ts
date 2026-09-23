import { Pool, types, type PoolClient, type QueryResultRow } from "pg";

types.setTypeParser(1082, (value) => value);

const globalForPg = globalThis as typeof globalThis & { workPool?: Pool };

export function getPool(): Pool {
  if (!globalForPg.workPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL не задан.");
    globalForPg.workPool = new Pool({
      connectionString,
      max: 10,
      options: "-c TimeZone=Europe/Moscow",
    });
  }
  return globalForPg.workPool;
}

export async function query<T extends QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  const result = await getPool().query<T>(text, params);
  return result.rows;
}

export async function withTx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function txQuery<T extends QueryResultRow>(
  client: PoolClient,
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await client.query<T>(text, params);
  return result.rows;
}
