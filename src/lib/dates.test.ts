import { describe, expect, it } from "vitest";
import {
  activeWeekStartForMonth,
  addUtcDays,
  addUtcMonths,
  formatMonthYear,
  inclusiveIsoDates,
  monthGridDates,
  utcDayDiff,
  utcMondayOf,
  utcMonthStart,
  weekDates,
  weekdayOf,
} from "./dates";

describe("weekdayOf", () => {
  it("maps UTC Monday through Sunday onto mon–sun", () => {
    expect(weekdayOf("2026-08-10")).toBe("mon");
    expect(weekdayOf("2026-08-15")).toBe("sat");
    expect(weekdayOf("2026-08-16")).toBe("sun");
  });
});

describe("utcDayDiff", () => {
  it("counts whole UTC days from earlier to later", () => {
    expect(utcDayDiff("2026-08-10", "2026-08-10")).toBe(0);
    expect(utcDayDiff("2026-08-16", "2026-08-10")).toBe(6);
    expect(utcDayDiff("2026-08-03", "2026-08-10")).toBe(-7);
  });
});

describe("addUtcDays", () => {
  it("adds days in UTC without shifting the calendar date", () => {
    expect(addUtcDays("2026-08-10", 6)).toBe("2026-08-16");
    expect(addUtcDays("2026-08-31", 1)).toBe("2026-09-01");
  });
});

describe("utcMondayOf", () => {
  it("returns the ISO Monday of the UTC week for Thursday and Sunday", () => {
    expect(utcMondayOf("2026-08-13")).toBe("2026-08-10");
    expect(utcMondayOf("2026-08-16")).toBe("2026-08-10");
    expect(utcMondayOf("2026-08-10")).toBe("2026-08-10");
  });
});

describe("weekDates", () => {
  it("returns seven consecutive UTC days from the Monday of the given week", () => {
    expect(weekDates("2026-08-10")).toEqual([
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
      "2026-08-13",
      "2026-08-14",
      "2026-08-15",
      "2026-08-16",
    ]);
    expect(weekDates("2026-08-13")).toEqual(weekDates("2026-08-10"));
  });
});

describe("utcMonthStart / addUtcMonths", () => {
  it("normalizes to the first of the UTC month and steps by whole months", () => {
    expect(utcMonthStart("2026-09-15")).toBe("2026-09-01");
    expect(addUtcMonths("2026-09-01", 1)).toBe("2026-10-01");
    expect(addUtcMonths("2026-09-15", -1)).toBe("2026-08-01");
  });
});

describe("inclusiveIsoDates", () => {
  it("includes both ends and is empty when from is after to", () => {
    expect(inclusiveIsoDates("2026-09-01", "2026-09-03")).toEqual(["2026-09-01", "2026-09-02", "2026-09-03"]);
    expect(inclusiveIsoDates("2026-09-03", "2026-09-01")).toEqual([]);
  });
});

describe("monthGridDates", () => {
  it("returns the Monday-start grid for September 2026 through that month's last Sunday", () => {
    const grid = monthGridDates("2026-09-01");
    expect(grid[0]).toBe("2026-08-31");
    expect(grid[grid.length - 1]).toBe("2026-10-04");
    expect(grid).toHaveLength(35);
  });
});

describe("activeWeekStartForMonth", () => {
  it("uses today's Monday when the visible month contains today, otherwise the month start's Monday", () => {
    expect(activeWeekStartForMonth("2026-09-01", "2026-09-02")).toBe("2026-08-31");
    expect(activeWeekStartForMonth("2026-10-01", "2026-09-02")).toBe("2026-09-28");
  });
});

describe("formatMonthYear", () => {
  it("formats a month-start ISO date as English long month and year in UTC", () => {
    expect(formatMonthYear("2026-09-01")).toBe("September 2026");
  });
});
