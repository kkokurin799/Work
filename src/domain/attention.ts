import { addDays } from "./dates";

export type Attention = "closed" | "undated" | "overdue" | "soon" | "ok";

const CLOSED_TASK = new Set(["done", "cancelled"]);
const SILENT_PROJECT = new Set(["paused", "launched", "cancelled"]);

export function attention(input: {
  taskStatus: string;
  projectStatus?: string | null;
  dueDate: string | null;
  today: string;
}): Attention {
  if (CLOSED_TASK.has(input.taskStatus)) return "closed";
  if (input.projectStatus && SILENT_PROJECT.has(input.projectStatus)) return "closed";
  if (!input.dueDate) return "undated";
  if (input.dueDate < input.today) return "overdue";
  if (input.dueDate <= addDays(input.today, 14)) return "soon";
  return "ok";
}

export function attentionLabel(value: Attention, dueDate: string | null, today: string): string | null {
  if (value === "soon" && dueDate) {
    const left = daysUntil(today, dueDate);
    if (left === 0) return "горит, срок сегодня";
    return `горит, через ${left} дн.`;
  }
  if (value === "overdue" && dueDate) {
    const late = daysUntil(dueDate, today);
    return `просрочено на ${late} дн.`;
  }
  if (value === "undated") return "без срока";
  return null;
}

function daysUntil(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return Math.round((end - start) / 86400000);
}

export function clearedT14Mark(
  nextDue: string | null,
  currentMark: string | null,
  today: string,
): string | null {
  if (!nextDue || nextDue > addDays(today, 14)) return null;
  return currentMark;
}
