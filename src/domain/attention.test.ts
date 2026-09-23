import { describe, expect, it } from "vitest";
import { attention, clearedT14Mark } from "./attention";

const today = "2026-10-01";

describe("attention", () => {
  it("marks an open item due in 14 days as soon and yesterday as overdue", () => {
    expect(attention({ taskStatus: "todo", dueDate: "2026-10-15", today })).toBe("soon");
    expect(attention({ taskStatus: "in_progress", dueDate: "2026-09-30", today })).toBe("overdue");
    expect(attention({ taskStatus: "todo", dueDate: "2026-10-16", today })).toBe("ok");
  });

  it("does not mark a finished item or an item inside a paused project", () => {
    expect(attention({ taskStatus: "done", dueDate: "2026-09-30", today })).toBe("closed");
    expect(
      attention({ taskStatus: "in_progress", projectStatus: "paused", dueDate: "2026-09-30", today }),
    ).toBe("closed");
    expect(
      attention({ taskStatus: "in_progress", projectStatus: "active", dueDate: "2026-10-05", today }),
    ).toBe("soon");
  });

  it("keeps a missing date out of the 14-day wave", () => {
    expect(attention({ taskStatus: "backlog", dueDate: null, today })).toBe("undated");
    expect(attention({ taskStatus: "done", dueDate: null, today })).toBe("closed");
  });

  it("clears the one-time alert only after the date leaves the window", () => {
    expect(clearedT14Mark("2026-11-20", "2026-10-10", today)).toBeNull();
    expect(clearedT14Mark("2026-10-08", "2026-10-10", today)).toBe("2026-10-10");
    expect(clearedT14Mark(null, "2026-10-10", today)).toBeNull();
  });
});
