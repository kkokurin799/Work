import Link from "next/link";
import { attentionLabel, type Attention } from "@/domain/attention";
import { formatDate, formatStamp } from "@/domain/dates";
import { BACKLOG_STATUSES, BENEFICIARIES, PROJECT_STATUSES, SIDES, SOURCES, TASK_STATUSES, label } from "@/domain/labels";
import type { ActivityItem } from "@/server/records";

export function Mark({ attention, due, today }: { attention: Attention; due: string | null; today: string }) {
  if (attention !== "soon" && attention !== "overdue" && attention !== "undated") return null;
  const text = attentionLabel(attention, due, today);
  if (!text) return null;
  return <span className={`mark ${attention}`}>{text}</span>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="panel empty">{children}</div>;
}

export function History({ items }: { items: ActivityItem[] }) {
  if (!items.length) return <p className="lead">Изменений срока, статуса и ответственного пока нет.</p>;
  return (
    <ul className="history">
      {items.map((item, index) => (
        <li key={`${item.createdAt}-${index}`}>
          <b>{formatStamp(item.createdAt)}</b> {item.actor ?? "система"}:{" "}
          {item.action === "create"
            ? "запись создана"
            : Object.entries(item.diff)
                .map(([key, value]) => `${key}: ${show(value.from)} → ${show(value.to)}`)
                .join("; ")}
        </li>
      ))}
    </ul>
  );
}

function show(value: string | null): string {
  if (!value) return "пусто";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return formatDate(value);
  return value;
}

export function StatusSelect({ kind, value }: { kind: "project" | "task" | "backlog"; value?: string }) {
  const pairs = kind === "project" ? PROJECT_STATUSES : kind === "task" ? TASK_STATUSES : BACKLOG_STATUSES;
  return (
    <label className="field">
      Статус
      <select name="status" defaultValue={value ?? pairs[0][0]}>
        {pairs.map(([code, title]) => (
          <option key={code} value={code}>
            {title}
          </option>
        ))}
      </select>
    </label>
  );
}

export function NamedSelect({
  labelText,
  name,
  rows,
  value,
  empty,
}: {
  labelText: string;
  name: string;
  rows: { id: string; name: string }[];
  value?: string | null;
  empty?: string;
}) {
  return (
    <label className="field">
      {labelText}
      <select name={name} defaultValue={value ?? ""}>
        {empty ? <option value="">{empty}</option> : null}
        {rows.map((row) => (
          <option key={row.id} value={row.id}>
            {row.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function sideLabel(code: string | null): string {
  return label(SIDES, code);
}

export function beneficiaryLabel(code: string | null, clientName: string | null): string {
  if (code === "client") return clientName ?? "Клиент";
  return label(BENEFICIARIES, code);
}

export function sourceLabel(code: string): string {
  return label(SOURCES, code);
}

export function TaskLink({ number, description }: { number: string; description: string }) {
  return (
    <Link href={`/tasks/${number}`}>
      {number}. {description}
    </Link>
  );
}

export { SIDES, formatDate };
