import { daysBetween, formatDate } from "./dates";
import { label, SIDES } from "./labels";

export type NoticeItem = {
  number: string;
  description: string;
  dueDate: string | null;
  assignee: string;
  side: string | null;
  beneficiaryLabel: string | null;
  projectNumber: string | null;
  projectName: string | null;
  attention: "overdue" | "soon" | "undated";
};

export function t14Text(item: NoticeItem, today: string, baseUrl: string): string {
  const when = item.dueDate ? formatDate(item.dueDate) : "без срока";
  const head =
    item.attention === "overdue" && item.dueDate
      ? `Просрочено ${item.number}, срок ${when} (${daysBetween(item.dueDate, today)} дн.)`
      : `Горит ${item.number}, срок ${when} (через ${item.dueDate ? daysBetween(today, item.dueDate) : "?"} дн.)`;
  const lines = [head, item.description, `Ответственный: ${item.assignee}`];
  if (item.side) lines.push(`Сторона: ${label(SIDES, item.side)}`);
  if (item.beneficiaryLabel) lines.push(`Для кого: ${item.beneficiaryLabel}`);
  if (item.projectNumber) lines.push(`Проект: ${item.projectNumber} ${item.projectName ?? ""}`.trim());
  lines.push(`${baseUrl}/tasks/${item.number}`);
  return lines.join("\n");
}

export function digestText(items: NoticeItem[], today: string, baseUrl: string): string {
  const blocks: Array<NoticeItem["attention"]> = ["overdue", "soon", "undated"];
  const titles = { overdue: "Просрочено", soon: "Горит", undated: "Без срока" };
  const lines = [`Сводка на ${formatDate(today)}`];
  let shown = 0;
  let hidden = 0;
  for (const block of blocks) {
    const group = items
      .filter((item) => item.attention === block)
      .sort((a, b) => {
        if (block === "undated") return a.number.localeCompare(b.number);
        return (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
      });
    if (!group.length) continue;
    lines.push("", titles[block]);
    for (const item of group) {
      if (shown >= 30) {
        hidden += 1;
        continue;
      }
      const due = item.dueDate ? `, срок ${formatDate(item.dueDate)}` : "";
      lines.push(`${item.number}: ${item.description}${due}. ${item.assignee}`);
      shown += 1;
    }
  }
  if (!shown) lines.push("", "Сроков, которые требуют внимания, нет.");
  if (hidden) lines.push("", `Ещё ${hidden}. ${baseUrl}/`);
  else lines.push("", baseUrl);
  return lines.join("\n");
}

export function intakeReply(input: {
  created: boolean;
  updated: boolean;
  unchanged: boolean;
  kindLabel: string;
  number: string;
  dueDate?: string | null;
  side?: string | null;
  changed?: string[];
}): string {
  if (input.created) {
    const due = input.dueDate ? ` Срок ${formatDate(input.dueDate)}` : "";
    const side = input.side ? `, сторона: ${label(SIDES, input.side)}` : "";
    return `${input.kindLabel} ${input.number} записана.${due}${side}.`.replace("..", ".");
  }
  if (input.unchanged) return `${input.kindLabel} ${input.number} без изменений.`;
  return `${input.kindLabel} ${input.number} обновлена: ${(input.changed ?? []).join(", ")}.`;
}
