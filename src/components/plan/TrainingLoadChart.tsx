import React, { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { DailyLoadEntry, LoadWeek } from "./training-load";

export const LOAD_CHART_CAPTION = "Easy / Threshold / Speed · km per week · logs + plan";
export const DAILY_LOAD_CAPTION = "Easy / Threshold / Speed · daily load (decay 0.85) · logs + plan";
export const LOAD_CHART_WEEK_TAB = "km per week";
export const LOAD_CHART_DAILY_TAB = "daily load (decay 0.85)";

type LoadChartTab = "daily" | "week";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

const SERIES = [
  { key: "easy", label: "Easy", bar: "bg-slate-400" },
  { key: "threshold", label: "Threshold", bar: "bg-orange-400" },
  { key: "speed", label: "Speed", bar: "bg-red-400" },
] as const;

export function formatWeekStartLabel(weekStart: string): string {
  const [year, month, day] = weekStart.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return `${utc.getUTCDate()} ${MONTHS[utc.getUTCMonth()]}`;
}

export default function TrainingLoadChart({ weeks }: { weeks: LoadWeek[] }) {
  const maxTotal = Math.max(1, ...weeks.map((week) => week.easy + week.threshold + week.speed));

  return (
    <figure className="space-y-2">
      <figcaption className="text-xs text-blue-100/70">{LOAD_CHART_CAPTION}</figcaption>
      <ul className="flex flex-wrap gap-3 text-xs text-blue-100/80">
        {SERIES.map((series) => (
          <li key={series.key} className="flex items-center gap-1">
            <span className={cn("size-1.5 shrink-0 rounded-full", series.bar)} aria-hidden="true" />
            {series.label}
          </li>
        ))}
      </ul>
      <div className="flex h-16 items-end gap-1">
        {weeks.map((week) => {
          const total = week.easy + week.threshold + week.speed;
          const columnPct = (total / maxTotal) * 100;
          return (
            <div key={week.weekStart} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div className="flex h-12 w-full items-end">
                <div className="flex w-full flex-col-reverse justify-start" style={{ height: `${columnPct}%` }}>
                  {SERIES.map((series) => {
                    const km = week[series.key];
                    if (km <= 0 || total <= 0) {
                      return null;
                    }
                    return (
                      <div
                        key={series.key}
                        className={cn("min-h-px w-full", series.bar)}
                        style={{ height: `${(km / total) * 100}%` }}
                      />
                    );
                  })}
                </div>
              </div>
              <p className="truncate text-[10px] text-blue-100/60">{formatWeekStartLabel(week.weekStart)}</p>
            </div>
          );
        })}
      </div>
    </figure>
  );
}

const DAILY_SERIES = [
  { key: "easy" as const, label: "Easy", stroke: "#94a3b8" },
  { key: "threshold" as const, label: "Threshold", stroke: "#fb923c" },
  { key: "speed" as const, label: "Speed", stroke: "#f87171" },
];

const SVG_W = 800;
const SVG_H = 160;
const PAD = { top: 10, right: 10, bottom: 24, left: 36 };

function formatDateLabel(iso: string): string {
  const day = Number(iso.slice(8, 10));
  const month = MONTHS[Number(iso.slice(5, 7)) - 1];
  return `${day} ${month}`;
}

export function DailyLoadChart({ days }: { days: DailyLoadEntry[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; entry: DailyLoadEntry } | null>(null);

  const plotW = SVG_W - PAD.left - PAD.right;
  const plotH = SVG_H - PAD.top - PAD.bottom;
  const maxLoad = Math.max(1, ...days.map((d) => Math.max(d.easy, d.threshold, d.speed)));
  const stepX = days.length > 1 ? plotW / (days.length - 1) : 0;

  const toX = useCallback((i: number) => PAD.left + i * stepX, [stepX]);
  const toY = useCallback((v: number) => PAD.top + plotH - (v / maxLoad) * plotH, [plotH, maxLoad]);

  const polylinePoints = (key: "easy" | "threshold" | "speed") =>
    days.map((d, i) => `${toX(i)},${toY(d[key])}`).join(" ");

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (svg === null || days.length === 0) {
        setTooltip(null);
        return;
      }
      const rect = svg.getBoundingClientRect();
      const mouseX = ((event.clientX - rect.left) / rect.width) * SVG_W;
      const idx = Math.round((mouseX - PAD.left) / (stepX || 1));
      const clamped = Math.max(0, Math.min(days.length - 1, idx));
      setTooltip({ x: toX(clamped), y: PAD.top, entry: days[clamped] });
    },
    [days, stepX, toX],
  );

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  const tickInterval = Math.max(1, Math.ceil(days.length / 8));

  return (
    <figure className="space-y-2">
      <figcaption className="text-xs text-blue-100/70">{DAILY_LOAD_CAPTION}</figcaption>
      <ul className="flex flex-wrap gap-3 text-xs text-blue-100/80">
        {DAILY_SERIES.map((s) => (
          <li key={s.key} className="flex items-center gap-1">
            <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: s.stroke }} aria-hidden="true" />
            {s.label}
          </li>
        ))}
      </ul>
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="w-full"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Daily training load chart"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Y-axis gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
            const y = PAD.top + plotH - frac * plotH;
            const val = (frac * maxLoad).toFixed(0);
            return (
              <g key={frac}>
                <line x1={PAD.left} y1={y} x2={SVG_W - PAD.right} y2={y} stroke="rgba(255,255,255,0.08)" />
                <text x={PAD.left - 4} y={y + 3} textAnchor="end" fill="rgba(148,163,184,0.5)" fontSize="9">
                  {val}
                </text>
              </g>
            );
          })}

          {/* X-axis date labels */}
          {days.map((d, i) =>
            i % tickInterval === 0 ? (
              <text key={d.date} x={toX(i)} y={SVG_H - 4} textAnchor="middle" fill="rgba(148,163,184,0.5)" fontSize="9">
                {formatDateLabel(d.date)}
              </text>
            ) : null,
          )}

          {/* Polylines */}
          {DAILY_SERIES.map((s) => (
            <polyline
              key={s.key}
              points={polylinePoints(s.key)}
              fill="none"
              stroke={s.stroke}
              strokeWidth="2"
              strokeLinejoin="round"
            />
          ))}

          {/* Hover indicator */}
          {tooltip !== null ? (
            <line
              x1={tooltip.x}
              y1={PAD.top}
              x2={tooltip.x}
              y2={PAD.top + plotH}
              stroke="rgba(255,255,255,0.3)"
              strokeDasharray="3,3"
            />
          ) : null}
        </svg>

        {/* HTML tooltip */}
        {tooltip !== null ? (
          <div
            className="pointer-events-none absolute rounded bg-slate-800/90 px-2 py-1 text-xs text-white shadow"
            style={{
              left: `${(tooltip.x / SVG_W) * 100}%`,
              top: 0,
              transform: "translateX(-50%)",
            }}
          >
            <p className="font-medium">{formatDateLabel(tooltip.entry.date)}</p>
            <p style={{ color: "#94a3b8" }}>Easy: {tooltip.entry.easy}</p>
            <p style={{ color: "#fb923c" }}>Threshold: {tooltip.entry.threshold}</p>
            <p style={{ color: "#f87171" }}>Speed: {tooltip.entry.speed}</p>
          </div>
        ) : null}
      </div>
    </figure>
  );
}

export function LoadChartTabs({ weeks, days }: { weeks: LoadWeek[]; days: DailyLoadEntry[] }) {
  const [selected, setSelected] = useState<LoadChartTab>("daily");

  return (
    <div className="space-y-2">
      <div role="tablist" aria-label="Training load" className="flex flex-wrap gap-1">
        <button
          type="button"
          role="tab"
          aria-selected={selected === "daily"}
          className={cn(
            "rounded-md px-2 py-1 text-xs",
            selected === "daily" ? "bg-white/15 text-white" : "text-blue-100/70 hover:bg-white/10",
          )}
          onClick={() => {
            setSelected("daily");
          }}
        >
          {LOAD_CHART_DAILY_TAB}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={selected === "week"}
          className={cn(
            "rounded-md px-2 py-1 text-xs",
            selected === "week" ? "bg-white/15 text-white" : "text-blue-100/70 hover:bg-white/10",
          )}
          onClick={() => {
            setSelected("week");
          }}
        >
          {LOAD_CHART_WEEK_TAB}
        </button>
      </div>
      <div role="tabpanel">
        {selected === "daily" ? <DailyLoadChart days={days} /> : <TrainingLoadChart weeks={weeks} />}
      </div>
    </div>
  );
}
