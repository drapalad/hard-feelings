import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  formatDayLabel,
  formatIsoWeekIncludesCaption,
  formatRevisionLabel,
  formatWeekRange,
  raceMarkerLabel,
} from "./PlanCalendar";

const source = readFileSync(path.join(import.meta.dirname, "PlanCalendar.tsx"), "utf8");
const labels = readFileSync(path.join(import.meta.dirname, "plan-month.ts"), "utf8");

describe("formatRevisionLabel", () => {
  it("formats ISO timestamps as UTC labels", () => {
    expect(formatRevisionLabel("2026-08-10T10:00:00.000Z")).toBe("2026-08-10 10:00:00 UTC");
  });
});

describe("formatDayLabel", () => {
  it("formats UTC ISO dates as weekday day month without a leading zero", () => {
    expect(formatDayLabel("2026-08-31")).toBe("Mon 31 Aug");
    expect(formatDayLabel("2026-09-06")).toBe("Sun 6 Sep");
  });
});

describe("formatWeekRange", () => {
  it("joins Monday and Sunday labels with an en dash", () => {
    expect(formatWeekRange("2026-08-31")).toBe("Mon 31 Aug – Sun 6 Sep");
  });
});

describe("formatIsoWeekIncludesCaption", () => {
  it("formats the bleed Monday as day and short month without a leading zero", () => {
    expect(formatIsoWeekIncludesCaption("2026-08-31")).toBe("ISO week includes 31 Aug");
    expect(formatIsoWeekIncludesCaption("2026-09-01")).toBe("ISO week includes 1 Sep");
  });
});

describe("raceMarkerLabel", () => {
  it("uses the race name and priority letter", () => {
    expect(raceMarkerLabel({ name: "Berlin", priority: "A" })).toBe("Berlin (A)");
  });

  it("falls back to Untitled race when name is missing or blank", () => {
    expect(raceMarkerLabel({ priority: "B" })).toBe("Untitled race (B)");
    expect(raceMarkerLabel({ name: "   ", priority: "C" })).toBe("Untitled race (C)");
  });
});

describe("month calendar chrome", () => {
  it("uses a seven-column month grid with Rest, Today, and 14-day generate labels", () => {
    expect(source).toContain("grid-cols-7");
    expect(source).toContain(">Rest<");
    expect(source).not.toContain(">Empty<");
    expect(source).toContain("generatePlanButtonLabel");
    expect(source).toContain("hasUnitInHorizon");
    expect(labels).toContain("Regenerate next 14 days");
    expect(labels).toContain("Generate next 14 days");
    expect(labels).toContain("Working...");
    expect(labels).toContain("Regenerate week");
    expect(labels).toContain("Generate week");
    expect(labels).not.toContain("Generate plan");
    expect(source).toContain('aria-label="Previous month"');
    expect(source).toContain('aria-label="Next month"');
    expect(source).toContain("Today");
    expect(source).toContain('aria-current={currentMonthVisible ? "date" : undefined}');
  });

  it("compacts the toolbar and phone cells and promotes structure", () => {
    expect(source).toContain("space-y-2");
    expect(source).toContain("text-base");
    expect(source).toContain("md:flex-nowrap");
    expect(source).toContain("gap-2");
    expect(source).toContain("min-h-12");
    expect(source).toContain("p-1");
    expect(source).toContain("Save snapshot");
    expect(source).toContain("Unsaved changes");
    expect(source).toContain('aria-label="Restore"');
    expect(source).toContain("formatCompactKm");
    expect(source).toContain("text-base font-medium");
    expect(source).toContain("sm:block");
    expect(source).toContain("hidden sm:inline");
    expect(source).toContain("onClick={onGenerate}");
    expect(source).toContain("onClick={onGenerateWeek}");
    expect(source).not.toContain("Generate to fill the calendar.");
    expect(source).not.toContain("Week history");
    expect(source).not.toContain("Restore a version");
    expect(source).not.toContain("No snapshots");
  });

  it("does not render cell Edit, Log, Unlog, or Freeze controls", () => {
    expect(source).not.toContain('aria-label="Edit"');
    expect(source).not.toContain("aria-label={`Log");
    expect(source).not.toContain("aria-label={`Unlog");
    expect(source).not.toContain("aria-label={unit.frozen");
    expect(source).not.toContain("onToggleFreeze");
    expect(source).not.toContain("onSaveEdit");
  });

  it("opens a panel below the month grid from an in-month or bleed-unit day button", () => {
    expect(source).toContain("aria-pressed={selected}");
    expect(source).toContain("{formatDayLabel(date)}");
    expect(source).toContain('aria-label="Close day"');
    expect(source).toContain('event.key === "Escape"');
    expect(source).toContain("logs: WorkoutLog[]");
    expect(source).toContain("Rest day. No planned workout.");
    expect(source).toContain("inMonth || unit");
    expect(source).toContain("const unit = byDate.get(date);");
    expect(source).toContain("selectedHasUnit");
    expect(source).toContain("formatIsoWeekIncludesCaption");
    expect(source).toContain("ISO week includes");
    const mapStart = source.indexOf("{grid.map((date) => {");
    const panelStart = source.indexOf("{selectedInMonth !== null ? (");
    expect(mapStart).toBeGreaterThan(-1);
    expect(panelStart).toBeGreaterThan(mapStart);
    expect(source.slice(mapStart, panelStart)).not.toContain('aria-label="Close day"');
    expect(source.slice(mapStart, panelStart)).not.toContain("formatDayLabel(date)");
  });

  it("mounts LoadChartTabs above the month grid from units and logs", () => {
    expect(source).toContain("LoadChartTabs");
    expect(source).toContain("aggregateLoadWeeks(units, logs, today)");
    expect(source).toContain("aggregateDailyLoad(units, logs, today)");
    const chartStart = source.indexOf("<LoadChartTabs");
    const gridStart = source.indexOf('className="grid grid-cols-7 gap-1"');
    expect(chartStart).toBeGreaterThan(-1);
    expect(gridStart).toBeGreaterThan(chartStart);
    expect(source).not.toContain("<TrainingLoadChart");
    expect(source).not.toContain("<DailyLoadChart");
    expect(source).not.toMatch(/2026-/);
  });

  it("overlays Flag and raceMarkerLabel on in-month cells and the day panel", () => {
    expect(source).toContain("races: Race[]");
    expect(source).toContain("racesByDate");
    expect(source).toContain("inMonth ? raceByDate.get(date) : undefined");
    expect(source).toContain("inMonth && race === undefined");
    expect(source).toContain("RaceMarker");
    expect(source).toContain("raceMarkerLabel");
    expect(source).toContain("Untitled race");
    expect(source).toContain('from "lucide-react"');
    expect(source).toContain("Flag");
    expect(source).toContain("race={race}");
    expect(source).toContain("race={selectedRace}");
    expect(source).not.toMatch(/2026-/);
  });

  it("mounts WorkoutStagesChart in the read-only day panel from the unit", () => {
    expect(source).toContain("WorkoutStagesChart");
    expect(source).toContain("structure={unit.structure}");
    expect(source).toContain("stages={unit.stages}");
    expect(source).toContain("distanceKm={unit.distanceKm}");
    expect(source).toContain("type={unit.type}");
  });

  it("keeps planned-unit Edit, Save log, Unlog, and Freeze in the panel", () => {
    expect(source).toContain("Distance (km)");
    expect(source).toContain("Structure");
    expect(source).toContain("Save log");
    expect(source).toContain("Unlog");
    expect(source).toContain('{unit.frozen ? "Unfreeze" : "Freeze"}');
    expect(source).toContain("onSaveUnit");
    expect(source).toContain("onSaveLog");
    expect(source).toContain("onSetFrozen");
    expect(source).toContain("Delete workout");
    expect(source).toContain("onDeleteUnit");
    expect(source).toContain("Make AI");
    expect(source).toContain("Edit");
    expect((source.match(/size="icon"/g) ?? []).length).toBe(2);
  });

  it("shows icon-only generate below sm with idle aria-label and full caption from sm up", () => {
    expect(source).toContain("RefreshCw");
    expect(source).toContain("CalendarDays");
    expect(source).toContain("aria-label={generatePlanButtonLabel(false, hasHorizonUnit)}");
    expect(source).toContain("aria-label={generateWeekButtonLabel(false, activeWeekHasUnits)}");
    expect(source).toContain('className="size-4 sm:hidden"');
    expect(source).toContain('className="hidden sm:inline"');
    expect(source).toContain("{generatePlanButtonLabel(busy, hasHorizonUnit)}");
    expect(source).toContain("{generateWeekButtonLabel(busy, activeWeekHasUnits)}");
    expect(source).toContain("onClick={onGenerate}");
    expect(source).toContain("onClick={onGenerateWeek}");
    expect(source).not.toContain("POST /api/plan");
  });

  it("compacts day-edit Type and Distance, closes log in details, and wires Make AI beside Structure", () => {
    expect(source).toContain("grid grid-cols-2 gap-2");
    expect(source).toContain('aria-label="Make AI"');
    expect(source).toContain("Seg 1");
    expect(source).toContain('"warmup"');
    expect(source).toContain("/api/plan/stages-from-description");
    expect(source).toContain('credentials: "same-origin"');
    expect(source).not.toContain("/api/chat/messages");
    expect(source).not.toContain("Make AI: slot beside Structure");
    expect(source).toContain("<details");
    expect(source).not.toContain("<details open");
    expect(source).toContain(">Log</summary>");
    expect(source).toContain("setEditing(true)");
    const detailsStart = source.indexOf("<details");
    const freezeStart = source.indexOf('{unit.frozen ? "Unfreeze" : "Freeze"}');
    expect(detailsStart).toBeGreaterThan(-1);
    expect(freezeStart).toBeGreaterThan(detailsStart);
    expect(source.slice(detailsStart, freezeStart)).toContain("Log km");
    expect(source.slice(detailsStart, freezeStart)).toContain("Save log");
    expect(source.slice(0, detailsStart)).not.toContain("Log km");
  });
});
