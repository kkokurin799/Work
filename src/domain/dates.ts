const DAY = 24 * 60 * 60 * 1000;

export function moscowToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(isoDate: string, days: number): string {
  const time = Date.parse(`${isoDate}T00:00:00Z`);
  return new Date(time + days * DAY).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return Math.round((end - start) / DAY);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [year, month, day] = iso.slice(0, 10).split("-");
  return `${day}.${month}.${year}`;
}

export function formatStamp(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function parseUserDate(value: string): string | null {
  const trimmed = value.trim();
  const dotted = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(trimmed);
  if (dotted) {
    const iso = `${dotted[3]}-${dotted[2]}-${dotted[1]}`;
    return isRealDate(iso) ? iso : null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed) && isRealDate(trimmed)) return trimmed;
  return null;
}

function isRealDate(iso: string): boolean {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function isWeekdayMorningWindow(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Moscow",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  if (["Sat", "Sun"].includes(weekday)) return false;
  return hour >= 9 && hour < 12;
}
