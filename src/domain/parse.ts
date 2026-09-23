import { parseUserDate } from "./dates";
import { BACKLOG_STATUSES, PROJECT_STATUSES, SIDES, TASK_STATUSES, codeByLabel } from "./labels";

const KEYS = [
  "Название",
  "Продукт",
  "Клиент",
  "Команда",
  "Срок",
  "Статус",
  "Описание",
  "Проект",
  "Ответственный",
  "Сторона",
  "Внешний номер",
  "Для кого",
  "Номер",
] as const;

type FieldKey = (typeof KEYS)[number];

const REQUIRED: Record<"project" | "task" | "backlog", FieldKey[]> = {
  project: ["Название", "Продукт", "Клиент", "Команда", "Срок"],
  task: ["Проект", "Описание", "Ответственный", "Сторона"],
  backlog: ["Продукт", "Описание", "Команда", "Ответственный", "Для кого", "Срок"],
};

export type RecordType = "project" | "task" | "backlog";

export type ParsedMessage =
  | {
      ok: true;
      type: RecordType;
      mode: "create" | "update";
      fields: Partial<Record<FieldKey, string>>;
    }
  | { ok: false; errors: string[] };

const TYPE_LINE: Record<string, RecordType> = {
  проект: "project",
  задача: "task",
  бэклог: "backlog",
};

export function parseMessage(raw: string): ParsedMessage {
  const lines = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  while (lines.length && !lines[0].trim()) lines.shift();
  if (!lines.length) return { ok: false, errors: ["Пустое сообщение."] };

  const type = TYPE_LINE[fold(lines[0])];
  if (!type) {
    return { ok: false, errors: ["Первая строка должна быть ПРОЕКТ, ЗАДАЧА или БЭКЛОГ."] };
  }

  const fields: Partial<Record<FieldKey, string>> = {};
  const errors: string[] = [];
  let currentKey: FieldKey | null = null;

  for (const line of lines.slice(1)) {
    const match = /^([^:]{1,40}):\s?(.*)$/.exec(line);
    const key = match ? canonicalKey(match[1]) : null;
    if (key) {
      if (fields[key] !== undefined) errors.push(`Поле «${key}» указано дважды.`);
      fields[key] = match![2].trim();
      currentKey = key;
      continue;
    }
    if (currentKey === "Описание") {
      const text = line.trim();
      fields["Описание"] = fields["Описание"] ? `${fields["Описание"]}\n${text}` : text;
      continue;
    }
    if (line.trim()) {
      errors.push(match ? `Неизвестное поле «${match[1].trim()}».` : `Непонятная строка: ${line.trim()}`);
    }
  }

  for (const [key, value] of Object.entries(fields) as [FieldKey, string][]) {
    if (!value) errors.push(`Поле «${key}» пустое.`);
  }

  const mode = fields["Номер"] ? "update" : "create";
  if (mode === "create") {
    for (const key of REQUIRED[type]) {
      if (!fields[key]) errors.push(`Нет поля «${key}».`);
    }
  }

  if (fields["Срок"] && !parseUserDate(fields["Срок"])) {
    errors.push("Срок записан не как ДД.ММ.ГГГГ.");
  }

  if (fields["Статус"] && !statusCode(type, fields["Статус"])) {
    errors.push(`Неизвестный статус «${fields["Статус"]}».`);
  }

  if (fields["Сторона"] && !codeByLabel(SIDES, fields["Сторона"])) {
    errors.push(`Неизвестная сторона «${fields["Сторона"]}».`);
  }

  if (errors.length) return { ok: false, errors: unique(errors) };
  return { ok: true, type, mode, fields };
}

export function statusCode(type: RecordType, label: string): string | null {
  if (type === "project") return codeByLabel(PROJECT_STATUSES, label);
  if (type === "task") return codeByLabel(TASK_STATUSES, label);
  return codeByLabel(BACKLOG_STATUSES, label);
}

export function canonicalBeneficiary(value: string): "all_clients" | "internal" | "client" {
  const folded = fold(value);
  if (folded === "все клиенты") return "all_clients";
  if (folded === "внутреннее") return "internal";
  return "client";
}

function canonicalKey(value: string): FieldKey | null {
  const folded = fold(value);
  return KEYS.find((key) => fold(key) === folded) ?? null;
}

function fold(value: string): string {
  return value.trim().toLowerCase().replaceAll("ё", "е");
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
