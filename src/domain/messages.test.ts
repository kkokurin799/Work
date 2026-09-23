import { describe, expect, it } from "vitest";
import { digestText, intakeReply, t14Text } from "./messages";

const item = {
  number: "T-0088",
  description: "Согласовать интеграционный контур",
  dueDate: "2026-10-10",
  assignee: "Петрова",
  side: "client",
  beneficiaryLabel: null,
  projectNumber: "P-0012",
  projectName: "Запуск Платежей в Альфа-Банке",
  attention: "soon" as const,
};

describe("messages", () => {
  it("builds the 14-day notice", () => {
    const text = t14Text(item, "2026-09-28", "https://work.local");
    expect(text).toContain("Горит T-0088");
    expect(text).toContain("через 12 дн.");
    expect(text).toContain("Сторона: Клиент");
    expect(text).toContain("https://work.local/tasks/T-0088");
  });

  it("caps the digest at 30 rows", () => {
    const items = Array.from({ length: 32 }, (_, index) => ({
      ...item,
      number: `T-${String(index + 1).padStart(4, "0")}`,
      attention: "overdue" as const,
    }));
    const text = digestText(items, "2026-10-12", "https://work.local");
    expect(text).toContain("Просрочено");
    expect(text).toContain("Ещё 2.");
  });

  it("confirms a created record", () => {
    expect(
      intakeReply({
        created: true,
        updated: false,
        unchanged: false,
        kindLabel: "Задача",
        number: "T-0088",
        dueDate: "2026-10-10",
        side: "client",
      }),
    ).toBe("Задача T-0088 записана. Срок 10.10.2026, сторона: Клиент.");
  });
});
