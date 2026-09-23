import { describe, expect, it } from "vitest";
import { parseMessage } from "./parse";

describe("parseMessage", () => {
  it("reads a project message", () => {
    const parsed = parseMessage(`ПРОЕКТ
Название: Запуск Платежей в Альфа-Банке
Продукт: Платежи
Клиент: Альфа-Банк
Команда: Внедрение
Срок: 15.12.2026
Статус: В работе
Описание: Пилот на одном расчётном контуре`);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.mode).toBe("create");
    expect(parsed.fields["Название"]).toBe("Запуск Платежей в Альфа-Банке");
    expect(parsed.fields["Статус"]).toBe("В работе");
  });

  it("reads a project task and keeps a multiline description", () => {
    const parsed = parseMessage(`ЗАДАЧА
Проект: P-0012
Описание: Согласовать интеграционный контур
и приложить схему
Ответственный: Петрова
Сторона: Клиент
Срок: 10.10.2026
Внешний номер: IMP-42`);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.fields["Описание"]).toBe("Согласовать интеграционный контур\nи приложить схему");
    expect(parsed.fields["Внешний номер"]).toBe("IMP-42");
  });

  it("reads a backlog item", () => {
    const parsed = parseMessage(`БЭКЛОГ
Продукт: Платежи
Описание: Повтор платежа при таймауте
Команда: Core
Ответственный: Иванов
Для кого: Альфа-Банк
Срок: 01.11.2026
Статус: В спринте`);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.type).toBe("backlog");
    expect(parsed.fields["Для кого"]).toBe("Альфа-Банк");
  });

  it("treats a number as an update and does not require the other fields", () => {
    const parsed = parseMessage(`ЗАДАЧА
Номер: T-0088
Сторона: Мы
Срок: 20.10.2026`);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.mode).toBe("update");
    expect(parsed.fields["Описание"]).toBeUndefined();
  });

  it("rejects a missing required field, a bad date and an unknown key", () => {
    const missing = parseMessage(`ЗАДАЧА
Проект: P-0012
Описание: Согласовать контур
Ответственный: Петрова`);
    expect(missing.ok).toBe(false);
    if (missing.ok) return;
    expect(missing.errors.join(" ")).toContain("Сторона");

    const date = parseMessage(`БЭКЛОГ
Продукт: Платежи
Описание: Повтор
Команда: Core
Ответственный: Иванов
Для кого: Альфа-Банк
Срок: 2026/11/01`);
    expect(date.ok).toBe(false);

    const key = parseMessage(`ПРОЕКТ
Название: Запуск
Продукт: Платежи
Клиент: Альфа-Банк
Команда: Внедрение
Срок: 15.12.2026
Приоритет: высокий`);
    expect(key.ok).toBe(false);
    if (key.ok) return;
    expect(key.errors.join(" ")).toContain("Приоритет");
  });
});
