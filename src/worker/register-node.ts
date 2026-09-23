import { migrate } from "../db/migrate";
import { startWorker } from "./loop";

void boot();

async function boot(): Promise<void> {
  await migrate();
  startWorker();
}
