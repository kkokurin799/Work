import fs from "node:fs/promises";
import path from "node:path";
import { moscowToday } from "../domain/dates";
import { databasePath, vacuumInto } from "../db/pool";

export async function backupDatabase(today = moscowToday()): Promise<string | null> {
  const source = databasePath();
  if (source === ":memory:") return null;
  const dir = path.join(process.cwd(), "backups");
  await fs.mkdir(dir, { recursive: true });
  const file = path.resolve(dir, `work-${today}.db`);
  try {
    const stat = await fs.stat(file);
    if (stat.size > 0) return file;
    await fs.unlink(file);
  } catch {
    // Today's copy is not written yet.
  }
  await vacuumInto(file);
  const files = (await fs.readdir(dir)).filter((name) => name.startsWith("work-") && name.endsWith(".db")).sort();
  while (files.length > 14) {
    const oldest = files.shift();
    if (oldest) await fs.unlink(path.join(dir, oldest));
  }
  return file;
}
