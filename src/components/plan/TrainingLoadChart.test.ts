import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DAILY_LOAD_CAPTION,
  formatWeekStartLabel,
  LOAD_CHART_CAPTION,
  LOAD_CHART_DAILY_TAB,
  LOAD_CHART_WEEK_TAB,
} from "./TrainingLoadChart";

const source = readFileSync(path.join(import.meta.dirname, "TrainingLoadChart.tsx"), "utf8");

describe("LOAD_CHART_CAPTION", () => {
  it("is the locked Easy / Threshold / Speed caption", () => {
    expect(LOAD_CHART_CAPTION).toBe("Easy / Threshold / Speed · km per week · logs + plan");
    expect(source).toContain(LOAD_CHART_CAPTION);
  });
});

describe("formatWeekStartLabel", () => {
  it("formats a Monday as day and month without a year", () => {
    expect(formatWeekStartLabel("2026-07-27")).toBe("27 Jul");
    expect(formatWeekStartLabel("2026-09-07")).toBe("7 Sep");
  });
});

describe("TrainingLoadChart source", () => {
  it("uses CSS stacked bars, cn(), and a three-series legend", () => {
    expect(source).toContain('from "@/lib/utils"');
    expect(source).toContain("cn(");
    expect(source).toContain("flex-col-reverse");
    expect(source).toContain("Easy");
    expect(source).toContain("Threshold");
    expect(source).toContain("Speed");
    expect(source).toContain("bg-slate-400");
    expect(source).toContain("bg-orange-400");
    expect(source).toContain("bg-red-400");
    expect(source).not.toContain("recharts");
    expect(source).not.toContain("chart.js");
    expect(source).not.toContain("chartjs");
    expect(source).not.toMatch(/2026-/);
  });
});

describe("DAILY_LOAD_CAPTION", () => {
  it("is the locked daily load caption", () => {
    expect(DAILY_LOAD_CAPTION).toBe("Easy / Threshold / Speed · daily load (decay 0.85) · logs + plan");
    expect(source).toContain(DAILY_LOAD_CAPTION);
  });
});

describe("DailyLoadChart source", () => {
  it("exports DailyLoadChart and uses SVG polyline elements", () => {
    expect(source).toContain("export function DailyLoadChart");
    expect(source).toContain("<svg");
    expect(source).toContain("<polyline");
  });

  it("references three bucket colors for the daily series", () => {
    expect(source).toContain("#94a3b8");
    expect(source).toContain("#fb923c");
    expect(source).toContain("#f87171");
  });

  it("does not use a charting library", () => {
    expect(source).not.toContain("recharts");
    expect(source).not.toContain("chart.js");
    expect(source).not.toContain("d3");
  });
});

describe("LoadChartTabs source", () => {
  it("locks tab labels to caption fragments, not Weekly/Daily", () => {
    expect(LOAD_CHART_WEEK_TAB).toBe("km per week");
    expect(LOAD_CHART_DAILY_TAB).toBe("daily load (decay 0.85)");
    expect(source).toContain(LOAD_CHART_WEEK_TAB);
    expect(source).toContain(LOAD_CHART_DAILY_TAB);
    expect(source).not.toContain("Weekly");
    expect(source).not.toContain(">Daily<");
  });

  it("defaults to the daily chart and mounts only one series", () => {
    expect(source).toContain('role="tablist"');
    expect(source).toContain('aria-label="Training load"');
    expect(source).toContain('role="tab"');
    expect(source).toContain('role="tabpanel"');
    expect(source).toContain('useState<LoadChartTab>("daily")');
    expect(source).toContain(
      '{selected === "daily" ? <DailyLoadChart days={days} /> : <TrainingLoadChart weeks={weeks} />}',
    );
    expect(source).toContain('type="button"');
  });
});
