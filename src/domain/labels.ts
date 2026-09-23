export const PROJECT_STATUSES = [
  ["draft", "Черновик"],
  ["preparing", "Подготовка"],
  ["active", "В работе"],
  ["paused", "Пауза"],
  ["launched", "Запущен"],
  ["cancelled", "Отменён"],
] as const;

export const TASK_STATUSES = [
  ["todo", "К выполнению"],
  ["in_progress", "В работе"],
  ["waiting", "Ожидание"],
  ["done", "Готово"],
  ["cancelled", "Отменено"],
] as const;

export const BACKLOG_STATUSES = [
  ["backlog", "Бэклог"],
  ["in_sprint", "В спринте"],
  ["done", "Готово"],
  ["cancelled", "Отменено"],
] as const;

export const SIDES = [
  ["ours", "Мы"],
  ["client", "Клиент"],
  ["partner", "Партнёр"],
] as const;

export const BENEFICIARIES = [
  ["client", "Конкретный клиент"],
  ["all_clients", "Все клиенты"],
  ["internal", "Внутреннее"],
] as const;

export const SOURCES = [
  ["manual", "Вручную"],
  ["telegram", "Telegram"],
  ["email", "Почта"],
] as const;

type Pair = readonly (readonly [string, string])[];

export function label(pairs: Pair, code: string | null | undefined): string {
  return pairs.find((item) => item[0] === code)?.[1] ?? code ?? "—";
}

export function codeByLabel(pairs: Pair, value: string): string | null {
  const normalized = fold(value);
  const found = pairs.find((item) => fold(item[1]) === normalized || fold(item[0]) === normalized);
  return found ? found[0] : null;
}

function fold(value: string): string {
  return value.trim().toLowerCase().replaceAll("ё", "е");
}

export const OPEN_PROJECT = new Set(["draft", "preparing", "active"]);
export const OPEN_TASK = new Set(["todo", "in_progress", "waiting", "backlog", "in_sprint"]);
