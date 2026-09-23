import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { moscowToday } from "../domain/dates";

const execFileAsync = promisify(execFile);

export async function backupDatabase(today = moscowToday()): Promise<string | null> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return null;
  const dir = path.join(process.cwd(), "backups");
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `work-${today}.sql`);
  try {
    const stat = await fs.stat(file);
    if (stat.size > 0) return file;
  } catch {
    // Today's copy is not written yet.
  }
  await execFileAsync("pg_dump", ["--no-owner", "--format=plain", `--file=${file}`, databaseUrl]);
  const files = (await fs.readdir(dir)).filter((name) => name.startsWith("work-") && name.endsWith(".sql")).sort();
  while (files.length > 14) {
    const oldest = files.shift();
    if (oldest) await fs.unlink(path.join(dir, oldest));
  }
  return file;
}
