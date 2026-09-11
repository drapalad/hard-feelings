import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { addUtcDays } from "@/lib/dates";
import { LIST_WINDOW_DAYS, listRows, listWindow, unitsInListWindow } from "./PlanList";
import type { Race, TrainingUnit } from "@/types";

const source = readFileSync(path.join(import.meta.dirname, "PlanList.tsx"), "utf8");

function unit(date: string, extras: Partial<TrainingUnit> = {}): TrainingUnit {
  return {
    date,
    type: "base",
    distanceKm: 8,
    frozen: false,
    ...extras,
  };
}

function race(date: string, extras: Partial<Race> = {}): Race {
  return {
    id: `race-${date}`,
    date,
    priority: "A",
    ...extras,
  };
}

describe("listWindow", () => {
  it("spans 21 inclusive UTC dates", () => {
    const from = "2024-01-15";
    const window = listWindow(from);
    expect(LIST_WINDOW_DAYS).toBe(21);
    expect(window.from).toBe(from);
    expect(window.to).toBe(addUtcDays(from, 20));
  });
});

describe("unitsInListWindow", () => {
  it("drops rest (no unit) and out-of-window rows and sorts by date", () => {
    const from = "2024-06-01";
    const to = "2024-06-21";
    const rows = unitsInListWindow(
      [
        unit("2024-06-21", { type: "long", distanceKm: 18 }),
        unit("2024-05-31"),
        unit("2024-06-10", { type: "tempo" }),
        unit("2024-06-22"),
        unit("2024-06-01", { type: "recovery" }),
      ],
      from,
      to,
    );
    expect(rows.map((row) => row.date)).toEqual(["2024-06-01", "2024-06-10", "2024-06-21"]);
  });

  it("keeps a unit whose structure is missing", () => {
    const from = "2024-06-01";
    const to = "2024-06-21";
    const rows = unitsInListWindow([unit("2024-06-03")], from, to);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.structure).toBeUndefined();
  });
});

describe("listRows", () => {
  it("unions in-window units and races, keeps race-only dates, and sorts", () => {
    const from = "2024-06-01";
    const to = "2024-06-21";
    const rows = listRows(
      [unit("2024-06-10", { type: "tempo" }), unit("2024-05-31")],
      [race("2024-06-10", { name: "Tune-up", priority: "B" }), race("2024-06-21"), race("2024-06-22")],
      from,
      to,
    );
    expect(rows.map((row) => row.date)).toEqual(["2024-06-10", "2024-06-21"]);
    expect(rows[0]?.unit?.type).toBe("tempo");
    expect(rows[0]?.race?.priority).toBe("B");
    expect(rows[1]?.unit).toBeUndefined();
    expect(rows[1]?.race?.name).toBeUndefined();
  });

  it("returns empty when the window has neither units nor races", () => {
    expect(listRows([unit("2024-05-01")], [race("2024-07-01")], "2024-06-01", "2024-06-21")).toEqual([]);
  });
});

describe("PlanList source", () => {
  it("fetches the live window when active and copies calendar type tones", () => {
    expect(source).toContain("/api/plan?from=");
    expect(source).toContain("active");
    expect(source).toContain("listWindow(utcToday())");
    expect(source).toContain("formatDayLabel");
    expect(source).toContain("truncate");
    expect(source).toContain("bg-slate-400");
    expect(source).toContain("bg-emerald-400");
    expect(source).toContain("bg-yellow-400");
    expect(source).toContain("bg-orange-400");
    expect(source).toContain("bg-red-400");
    expect(source).toContain("bg-purple-400");
    expect(source).not.toContain("waitForTimeout");
    expect(source).not.toMatch(/2026-/);
  });

  it("overlays RaceMarker on union rows and empties only when rows are empty", () => {
    const tabs = readFileSync(path.join(import.meta.dirname, "../dashboard/DashboardTabs.tsx"), "utf8");
    expect(tabs).toContain("<PlanList");
    const listOpen = tabs.indexOf("<PlanList");
    expect(tabs.slice(listOpen, tabs.indexOf("/>", listOpen))).toContain("races={liveRaces}");
    expect(source).toContain("races: Race[]");
    expect(source).toContain("listRows");
    expect(source).toContain("RaceMarker");
    expect(source).toContain("rows.length === 0");
    expect(source).not.toContain("units.length === 0");
    expect(source).not.toMatch(/2026-/);
  });
});
