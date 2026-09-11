import React, { useEffect, useState } from "react";
import { ServerError } from "@/components/auth/ServerError";
import { addUtcDays, utcToday } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Race, TrainingUnit, WorkoutType } from "@/types";
import { formatDayLabel, RaceMarker } from "./PlanCalendar";

export const LIST_WINDOW_DAYS = 21;

export function listWindow(today: string): { from: string; to: string } {
  return { from: today, to: addUtcDays(today, LIST_WINDOW_DAYS - 1) };
}

export function unitsInListWindow(units: TrainingUnit[], from: string, to: string): TrainingUnit[] {
  return units.filter((unit) => unit.date >= from && unit.date <= to).sort((a, b) => a.date.localeCompare(b.date));
}

export interface PlanListRow {
  date: string;
  unit?: TrainingUnit;
  race?: Race;
}

export function listRows(units: TrainingUnit[], races: Race[], from: string, to: string): PlanListRow[] {
  const byDate = new Map<string, PlanListRow>();
  for (const unit of unitsInListWindow(units, from, to)) {
    byDate.set(unit.date, { date: unit.date, unit });
  }
  for (const race of races) {
    if (race.date < from || race.date > to) {
      continue;
    }
    const existing = byDate.get(race.date);
    if (existing === undefined) {
      byDate.set(race.date, { date: race.date, race });
    } else {
      existing.race = race;
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

const TYPE_TONE: Record<WorkoutType, { chip: string; text: string }> = {
  base: { chip: "bg-slate-400", text: "text-slate-300" },
  recovery: { chip: "bg-emerald-400", text: "text-emerald-300" },
  tempo: { chip: "bg-yellow-400", text: "text-yellow-300" },
  threshold: { chip: "bg-orange-400", text: "text-orange-300" },
  anaerobic: { chip: "bg-red-400", text: "text-red-300" },
  long: { chip: "bg-purple-400", text: "text-purple-300" },
};

interface PlanListProps {
  active: boolean;
  races: Race[];
}

interface ApiErrorBody {
  code: string;
  message: string;
}

function readError(body: unknown): ApiErrorBody {
  if (typeof body !== "object" || body === null || !("error" in body)) {
    return { code: "UNKNOWN", message: "Request failed" };
  }
  const error = body.error;
  if (typeof error !== "object" || error === null) {
    return { code: "UNKNOWN", message: "Request failed" };
  }
  const code = "code" in error && typeof error.code === "string" ? error.code : "UNKNOWN";
  const message = "message" in error && typeof error.message === "string" ? error.message : "Request failed";
  return { code, message };
}

async function readBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function asUnits(value: unknown): TrainingUnit[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  return value as TrainingUnit[];
}

function WorkoutTypeLabel({ type }: { type: WorkoutType }) {
  const tone = TYPE_TONE[type];
  return (
    <p className={cn("flex items-center gap-1 text-xs font-medium capitalize", tone.text)}>
      <span className={cn("size-1.5 shrink-0 rounded-full", tone.chip)} aria-hidden="true" />
      {type}
    </p>
  );
}

export default function PlanList({ active, races }: PlanListProps) {
  const [units, setUnits] = useState<TrainingUnit[]>([]);
  const [status, setStatus] = useState<"idle" | "ready" | "error">("idle");
  const [error, setError] = useState<string | undefined>();
  const { from, to } = listWindow(utcToday());
  const rows = listRows(units, races, from, to);

  useEffect(() => {
    if (!active) {
      return;
    }
    const { from, to } = listWindow(utcToday());
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/plan?from=${from}&to=${to}`, {
          credentials: "same-origin",
          signal: controller.signal,
        });
        const body = await readBody(response);
        if (controller.signal.aborted) {
          return;
        }
        if (!response.ok) {
          const apiError = readError(body);
          setError(`${apiError.code}: ${apiError.message}`);
          setStatus("error");
          return;
        }
        const nextUnits = typeof body === "object" && body !== null && "units" in body ? asUnits(body.units) : null;
        setUnits(nextUnits === null ? [] : unitsInListWindow(nextUnits, from, to));
        setError(undefined);
        setStatus("ready");
      } catch (caught) {
        if (controller.signal.aborted || (caught instanceof DOMException && caught.name === "AbortError")) {
          return;
        }
        setError("UNKNOWN: Request failed");
        setStatus("error");
      }
    })();
    return () => {
      controller.abort();
    };
  }, [active]);

  return (
    <section aria-label="Upcoming workouts" className="space-y-3 text-left">
      <ServerError message={error} />
      {status === "ready" && rows.length === 0 ? (
        <p className="text-sm text-blue-100/70">No planned workouts in the next 21 days.</p>
      ) : null}
      {rows.length > 0 ? (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.date} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-sm font-medium text-white">{formatDayLabel(row.date)}</p>
              {row.race ? <RaceMarker race={row.race} /> : null}
              {row.unit ? (
                <>
                  <WorkoutTypeLabel type={row.unit.type} />
                  <p className="text-xs text-blue-100/80">{row.unit.distanceKm.toFixed(1)} km</p>
                  {row.unit.structure ? (
                    <p className={cn("truncate text-xs text-blue-100/60")}>{row.unit.structure}</p>
                  ) : null}
                </>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
