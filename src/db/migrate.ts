import fs from "node:fs";
import path from "node:path";
import { getPool } from "./pool";
import { seedOwner } from "../server/auth";

export async function migrate(): Promise<void> {
  const sql = fs.readFileSync(path.join(process.cwd(), "src/db/schema.sql"), "utf8");
  await getPool().query(sql);
  await seedOwner();
}

if (process.argv[1]?.endsWith("migrate.ts")) {
  migrate()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
