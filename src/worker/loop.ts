import { backupDatabase } from "../server/backup";
import { pollMailbox } from "../server/mail";
import { deliverDigest, deliverDueNotices } from "../server/notify";

let started = false;

export function startWorker(): void {
  if (started || process.env.WORKER_DISABLED === "1") return;
  started = true;
  const safe = (label: string, fn: () => Promise<unknown>) => () => {
    fn().catch((error) => {
      console.error(label, error instanceof Error ? error.message : error);
    });
  };
  setInterval(safe("оповещения", () => deliverDueNotices()), 60 * 60 * 1000);
  setInterval(safe("почта", () => pollMailbox()), 3 * 60 * 1000);
  setInterval(safe("сводка", () => deliverDigest()), 60 * 1000);
  setInterval(safe("копия", () => backupDatabase()), 60 * 60 * 1000);
  safe("оповещения", () => deliverDueNotices())();
  safe("почта", () => pollMailbox())();
  safe("копия", () => backupDatabase())();
}
