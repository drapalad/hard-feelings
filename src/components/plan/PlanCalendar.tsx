import React, { useEffect, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Flag, RefreshCw, Snowflake } from "lucide-react";
import { ServerError } from "@/components/auth/ServerError";
import { Button } from "@/components/ui/button";
import { formatMonthYear, monthGridDates, utcMonthStart, utcToday, addUtcDays, weekDates } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type {
  BoundViolation,
  PlanRevisionSummary,
  Race,
  TrainingUnit,
  UnitStage,
  WorkoutLog,
  WorkoutStageKind,
  WorkoutType,
} from "@/types";
import {
  formatCompactKm,
  generatePlanButtonLabel,
  generateWeekButtonLabel,
  hasUnitInHorizon,
  weekHasUnits,
} from "./plan-month";
import { LoadChartTabs } from "./TrainingLoadChart";
import { aggregateDailyLoad, aggregateLoadWeeks } from "./training-load";
import { formatStructureFromStages } from "./workout-stages";
import WorkoutStagesChart from "./WorkoutStagesChart";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const WEEKDAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const WORKOUT_TYPES: WorkoutType[] = ["base", "recovery", "tempo", "threshold", "anaerobic", "long"];
const STAGE_KINDS: WorkoutStageKind[] = ["warmup", "work", "recovery", "cooldown"];
const MAX_EDITOR_STAGES = 20;

const TYPE_TONE: Record<WorkoutType, { chip: string; text: string }> = {
  base: { chip: "bg-slate-400", text: "text-slate-300" },
  recovery: { chip: "bg-emerald-400", text: "text-emerald-300" },
  tempo: { chip: "bg-yellow-400", text: "text-yellow-300" },
  threshold: { chip: "bg-orange-400", text: "text-orange-300" },
  anaerobic: { chip: "bg-red-400", text: "text-red-300" },
  long: { chip: "bg-purple-400", text: "text-purple-300" },
};

const fieldClass =
  "w-full rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-sm text-white placeholder-white/40 focus:ring-2 focus:ring-purple-400 focus:outline-none";

const iconBtnClass = "border-white/20 bg-white/10 text-white hover:bg-white/20";

export function formatPace(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

export function parsePace(input: string): number | undefined {
  const trimmed = input.trim();
  if (trimmed === "") {
    return undefined;
  }
  const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (match === null) {
    return undefined;
  }
  const minutes = Number(match[1]);
  const secs = Number(match[2]);
  if (secs >= 60) {
    return undefined;
  }
  return minutes * 60 + secs;
}

export interface UnitEditPayload {
  date: string;
  type: WorkoutType;
  distanceKm: number;
  structure: string;
  stages?: UnitStage[];
}

function emptyStage(): UnitStage {
  return { kind: "work", label: "", duration: "", target: "" };
}

function seedEditorStages(unit: TrainingUnit | undefined): UnitStage[] {
  if (unit?.stages !== undefined && unit.stages.length > 0) {
    return unit.stages.map((stage) => ({ ...stage }));
  }
  return [];
}

function segmentHeading(index: number): string {
  if (index === 0) {
    return "Seg 1";
  }
  return `Seg ${index + 1}`;
}

function isWorkoutStageKind(value: unknown): value is WorkoutStageKind {
  return STAGE_KINDS.includes(value as WorkoutStageKind);
}

function isUnitStage(value: unknown): value is UnitStage {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (!("kind" in value) || !("label" in value) || !("duration" in value) || !("target" in value)) {
    return false;
  }
  return (
    isWorkoutStageKind(value.kind) &&
    typeof value.label === "string" &&
    typeof value.duration === "string" &&
    typeof value.target === "string"
  );
}

function stagesFromResponse(body: unknown): UnitStage[] | null {
  if (typeof body !== "object" || body === null || !("stages" in body) || !Array.isArray(body.stages)) {
    return null;
  }
  const stages: UnitStage[] = [];
  for (const item of body.stages) {
    if (!isUnitStage(item)) {
      return null;
    }
    stages.push(item);
  }
  return stages;
}

function readApiMessage(body: unknown): string {
  if (typeof body === "object" && body !== null && "error" in body) {
    const error = body.error;
    if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
      return error.message;
    }
  }
  return "Could not parse stages";
}

interface PlanCalendarProps {
  weekStart: string;
  visibleMonth: string;
  units: TrainingUnit[];
  races: Race[];
  logs: WorkoutLog[];
  error?: string;
  warnings: BoundViolation[];
  busy: boolean;
  revisions: PlanRevisionSummary[];
  snapshotDirty: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onGenerate: () => void;
  onGenerateWeek: () => void;
  onSaveSnapshot: () => void;
  onRestore: (revisionId: string) => void;
  onSaveUnit: (payload: UnitEditPayload) => void;
  onSaveLog: (date: string, distanceKm: number, avgPaceSecPerKm?: number, avgHr?: number) => void;
  onUnlog: (date: string) => void;
  onSetFrozen: (unit: TrainingUnit) => void;
  onDeleteUnit: (date: string) => void;
}

function unitsByDate(units: TrainingUnit[]): Map<string, TrainingUnit> {
  return new Map(units.map((unit) => [unit.date, unit]));
}

function logsByDate(logs: WorkoutLog[]): Map<string, WorkoutLog> {
  return new Map(logs.map((log) => [log.date, log]));
}

function racesByDate(races: Race[]): Map<string, Race> {
  return new Map(races.map((race) => [race.date, race]));
}

export function raceMarkerLabel(race: Pick<Race, "name" | "priority">): string {
  const trimmed = race.name?.trim() ?? "";
  const displayName = trimmed === "" ? "Untitled race" : trimmed;
  return `${displayName} (${race.priority})`;
}

export function RaceMarker({ race }: { race: Race }) {
  const label = raceMarkerLabel(race);
  return (
    <p className="mt-1 flex items-center gap-1 truncate text-xs text-purple-200" title={label}>
      <Flag className="size-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </p>
  );
}

export function formatRevisionLabel(createdAt: string): string {
  const parsed = Date.parse(createdAt);
  if (Number.isNaN(parsed)) {
    return createdAt;
  }
  return new Date(parsed)
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d{3}Z$/, " UTC");
}

export function formatDayLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return `${WEEKDAYS[utc.getUTCDay()]} ${utc.getUTCDate()} ${MONTHS[month - 1]}`;
}

export function formatWeekRange(weekStart: string): string {
  const dates = weekDates(weekStart);
  return `${formatDayLabel(dates[0])} – ${formatDayLabel(dates[6])}`;
}

export function formatIsoWeekIncludesCaption(isoDate: string): string {
  const [, month, day] = isoDate.split("-").map(Number);
  return `ISO week includes ${day} ${MONTHS[month - 1]}`;
}

function WorkoutTypeLabel({ type, showName = true }: { type: WorkoutType; showName?: boolean }) {
  const tone = TYPE_TONE[type];
  return (
    <p className={cn("flex items-center gap-1 text-xs font-medium capitalize", tone.text)}>
      <span className={cn("size-1.5 shrink-0 rounded-full", tone.chip)} aria-hidden="true" />
      {showName ? type : <span className="hidden sm:inline">{type}</span>}
    </p>
  );
}

function isInVisibleMonth(date: string, visibleMonth: string): boolean {
  return utcMonthStart(date) === utcMonthStart(visibleMonth);
}

function LogMetrics({ log }: { log: WorkoutLog | undefined }) {
  if (log === undefined) {
    return null;
  }
  const parts: string[] = [];
  if (log.avgPaceSecPerKm !== undefined) {
    parts.push(`${formatPace(log.avgPaceSecPerKm)} /km`);
  }
  if (log.avgHr !== undefined) {
    parts.push(`${log.avgHr} bpm`);
  }
  if (parts.length === 0) {
    return null;
  }
  return <p className="hidden truncate text-xs text-blue-100/50 sm:block">{parts.join(" · ")}</p>;
}

function DaySummary({
  dayNumber,
  isToday,
  unit,
  race,
  log,
  inMonth,
}: {
  dayNumber: number;
  isToday: boolean;
  unit: TrainingUnit | undefined;
  race: Race | undefined;
  log: WorkoutLog | undefined;
  inMonth: boolean;
}) {
  return (
    <>
      <p className="text-xs text-blue-100/70">
        {dayNumber}
        {isToday ? (
          <span className="ml-1 hidden text-[10px] font-semibold tracking-wide text-white sm:inline">TODAY</span>
        ) : null}
        {unit?.frozen ? <Snowflake className="ml-1 inline size-3 text-purple-200" aria-hidden="true" /> : null}
      </p>
      {unit ? (
        <div className="mt-1 space-y-0.5">
          <WorkoutTypeLabel type={unit.type} showName={false} />
          <p className="text-xs text-blue-100/80">
            <span className="sm:hidden">{formatCompactKm(unit.distanceKm)}</span>
            <span className="hidden sm:inline">{unit.distanceKm.toFixed(1)} km</span>
          </p>
          {unit.structure ? (
            <p className="hidden truncate text-xs text-blue-100/60 sm:block">{unit.structure}</p>
          ) : null}
          <LogMetrics log={log} />
        </div>
      ) : inMonth && race === undefined ? (
        <p className="mt-1 hidden text-xs text-blue-100/50 sm:block">Rest</p>
      ) : null}
      {race ? <RaceMarker race={race} /> : null}
    </>
  );
}

function DayPanel({
  date,
  unit,
  race,
  log,
  busy,
  onClose,
  onSaveUnit,
  onSaveLog,
  onUnlog,
  onSetFrozen,
  onDeleteUnit,
}: {
  date: string;
  unit: TrainingUnit | undefined;
  race: Race | undefined;
  log: WorkoutLog | undefined;
  busy: boolean;
  onClose: () => void;
  onSaveUnit: (payload: UnitEditPayload) => void;
  onSaveLog: (date: string, distanceKm: number, avgPaceSecPerKm?: number, avgHr?: number) => void;
  onUnlog: (date: string) => void;
  onSetFrozen: (unit: TrainingUnit) => void;
  onDeleteUnit: (date: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editType, setEditType] = useState<WorkoutType>(unit?.type ?? "base");
  const [editKm, setEditKm] = useState(String(unit?.distanceKm ?? ""));
  const [editStructure, setEditStructure] = useState(unit?.structure ?? "");
  const [editStages, setEditStages] = useState<UnitStage[]>(() => seedEditorStages(unit));
  const [makeAiError, setMakeAiError] = useState<string | undefined>(undefined);
  const [makingAi, setMakingAi] = useState(false);
  const [logKm, setLogKm] = useState(String(log?.distanceKm ?? unit?.distanceKm ?? ""));
  const [logPace, setLogPace] = useState(log?.avgPaceSecPerKm !== undefined ? formatPace(log.avgPaceSecPerKm) : "");
  const [logHr, setLogHr] = useState(log?.avgHr !== undefined ? String(log.avgHr) : "");

  function saveEdit() {
    if (unit === undefined) {
      return;
    }
    const distanceKm = Number(editKm);
    if (!Number.isFinite(distanceKm) || distanceKm < 0) {
      return;
    }
    onSaveUnit({
      date,
      type: editType,
      distanceKm,
      structure: editStages.length > 0 ? formatStructureFromStages(editStages) : editStructure,
      stages: editStages,
    });
    setEditing(false);
  }

  function patchStage(index: number, patch: Partial<UnitStage>) {
    setEditStages((current) => current.map((stage, rowIndex) => (rowIndex === index ? { ...stage, ...patch } : stage)));
  }

  async function requestStagesFromDescription(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    setMakeAiError(undefined);
    setMakingAi(true);
    try {
      const response = await fetch("/api/plan/stages-from-description", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ structure: editStructure }),
      });
      const body: unknown = await response.json().catch(() => undefined);
      if (!response.ok) {
        setMakeAiError(readApiMessage(body));
        return;
      }
      const stages = stagesFromResponse(body);
      if (stages === null) {
        setMakeAiError("Could not parse stages");
        return;
      }
      setEditStages(stages);
    } catch {
      setMakeAiError("Could not parse stages");
    } finally {
      setMakingAi(false);
    }
  }

  function saveLog() {
    const distanceKm = Number(logKm);
    if (!Number.isFinite(distanceKm) || distanceKm < 0) {
      return;
    }
    const pace = parsePace(logPace);
    const hr = logHr.trim() === "" ? undefined : Number(logHr);
    const validHr = hr !== undefined && Number.isInteger(hr) ? hr : undefined;
    onSaveLog(date, distanceKm, pace, validHr);
  }

  return (
    <div className="space-y-2 rounded-lg border border-white/15 bg-white/5 p-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-white">{formatDayLabel(date)}</h3>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={iconBtnClass}
          onClick={onClose}
          aria-label="Close day"
        >
          Close
        </Button>
      </div>
      {race ? <RaceMarker race={race} /> : null}
      {unit ? (
        <div className="space-y-2">
          {editing ? (
            <form
              className="space-y-1.5"
              onSubmit={(event) => {
                event.preventDefault();
                saveEdit();
              }}
            >
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs text-blue-100/70">
                  Type
                  <select
                    className={cn(fieldClass, "mt-0.5 py-0.5 capitalize")}
                    value={editType}
                    disabled={busy}
                    onChange={(event) => {
                      setEditType(event.target.value as WorkoutType);
                    }}
                  >
                    {WORKOUT_TYPES.map((type) => (
                      <option key={type} value={type} className="bg-slate-900 capitalize">
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs text-blue-100/70">
                  Distance (km)
                  <input
                    className={cn(fieldClass, "mt-0.5 py-0.5")}
                    type="number"
                    min="0"
                    step="0.1"
                    value={editKm}
                    disabled={busy}
                    onChange={(event) => {
                      setEditKm(event.target.value);
                    }}
                  />
                </label>
              </div>
              <div className="flex items-end gap-2">
                <label className="block min-w-0 flex-1 text-xs text-blue-100/70">
                  Structure
                  <input
                    className={cn(fieldClass, "mt-0.5 py-0.5")}
                    type="text"
                    value={editStructure}
                    disabled={busy || makingAi}
                    onChange={(event) => {
                      setEditStructure(event.target.value);
                    }}
                  />
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={iconBtnClass}
                  disabled={busy || makingAi}
                  aria-label="Make AI"
                  onClick={(event) => {
                    void requestStagesFromDescription(event);
                  }}
                >
                  Make AI
                </Button>
              </div>
              {makeAiError ? <p className="text-xs text-red-300">{makeAiError}</p> : null}
              {editStages.map((stage, index) => (
                <fieldset key={index} className="space-y-1 rounded-md border border-white/10 p-1.5">
                  <legend className="px-1 text-xs text-blue-100/70">{segmentHeading(index)}</legend>
                  <div className="grid grid-cols-2 gap-1">
                    <label className="block text-xs text-blue-100/70">
                      Kind
                      <select
                        className={cn(fieldClass, "mt-0.5 py-0.5")}
                        value={stage.kind}
                        disabled={busy || makingAi}
                        onChange={(event) => {
                          patchStage(index, { kind: event.target.value as WorkoutStageKind });
                        }}
                      >
                        {STAGE_KINDS.map((kind) => (
                          <option key={kind} value={kind} className="bg-slate-900">
                            {kind}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-xs text-blue-100/70">
                      Duration
                      <input
                        className={cn(fieldClass, "mt-0.5 py-0.5")}
                        type="text"
                        value={stage.duration}
                        disabled={busy || makingAi}
                        onChange={(event) => {
                          patchStage(index, { duration: event.target.value });
                        }}
                      />
                    </label>
                    <label className="block text-xs text-blue-100/70">
                      Label
                      <input
                        className={cn(fieldClass, "mt-0.5 py-0.5")}
                        type="text"
                        value={stage.label}
                        disabled={busy || makingAi}
                        onChange={(event) => {
                          patchStage(index, { label: event.target.value });
                        }}
                      />
                    </label>
                    <label className="block text-xs text-blue-100/70">
                      Target
                      <input
                        className={cn(fieldClass, "mt-0.5 py-0.5")}
                        type="text"
                        value={stage.target}
                        disabled={busy || makingAi}
                        onChange={(event) => {
                          patchStage(index, { target: event.target.value });
                        }}
                      />
                    </label>
                  </div>
                </fieldset>
              ))}
              {editStages.length > 0 ? (
                <WorkoutStagesChart
                  stages={editStages}
                  distanceKm={Number(editKm) || unit.distanceKm}
                  type={editType}
                />
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={cn("w-full", iconBtnClass)}
                disabled={busy || makingAi || editStages.length >= MAX_EDITOR_STAGES}
                onClick={() => {
                  setEditStages((current) => [...current, emptyStage()]);
                }}
              >
                Add segment
              </Button>
              <div className="flex gap-1">
                <Button type="submit" size="sm" disabled={busy || makingAi} className="flex-1 bg-purple-600 text-white">
                  Save
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy || makingAi}
                  className={cn("flex-1", iconBtnClass)}
                  onClick={() => {
                    setEditing(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-1">
              {unit.structure ? <p className="text-base font-medium text-white">{unit.structure}</p> : null}
              <WorkoutStagesChart
                structure={unit.structure}
                stages={unit.stages}
                distanceKm={unit.distanceKm}
                type={unit.type}
              />
              <WorkoutTypeLabel type={unit.type} />
              <p className="text-sm text-blue-100/80">{unit.distanceKm.toFixed(1)} km planned</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                className={iconBtnClass}
                onClick={() => {
                  setEditing(true);
                }}
              >
                Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                className={iconBtnClass}
                onClick={() => {
                  onDeleteUnit(date);
                }}
              >
                Delete workout
              </Button>
            </div>
          )}
          <details className="rounded-md border border-white/10 bg-white/5 text-sm text-blue-100/80">
            <summary className="cursor-pointer px-2 py-1 text-blue-50">Log</summary>
            <div className="space-y-1.5 px-2 pb-2">
              {log ? (
                <p className="text-sm text-emerald-200/90">
                  Logged {log.distanceKm.toFixed(1)} km (planned {unit.distanceKm.toFixed(1)} km)
                </p>
              ) : null}
              <label className="block text-xs text-blue-100/70">
                Log km
                <input
                  className={cn(fieldClass, "mt-0.5 py-0.5")}
                  type="number"
                  min="0"
                  step="0.1"
                  value={logKm}
                  disabled={busy}
                  onChange={(event) => {
                    setLogKm(event.target.value);
                  }}
                />
              </label>
              <label className="block text-xs text-blue-100/70">
                Pace (mm:ss /km)
                <input
                  className={cn(fieldClass, "mt-0.5 py-0.5")}
                  type="text"
                  placeholder="5:12"
                  value={logPace}
                  disabled={busy}
                  onChange={(event) => {
                    setLogPace(event.target.value);
                  }}
                />
              </label>
              <label className="block text-xs text-blue-100/70">
                HR (bpm)
                <input
                  className={cn(fieldClass, "mt-0.5 py-0.5")}
                  type="number"
                  min="60"
                  max="220"
                  step="1"
                  value={logHr}
                  disabled={busy}
                  onChange={(event) => {
                    setLogHr(event.target.value);
                  }}
                />
              </label>
              <div className="flex flex-wrap gap-1">
                <Button type="button" size="sm" disabled={busy} className="bg-purple-600 text-white" onClick={saveLog}>
                  Save log
                </Button>
                {log ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    className={iconBtnClass}
                    onClick={() => {
                      onUnlog(date);
                    }}
                  >
                    Unlog
                  </Button>
                ) : null}
              </div>
            </div>
          </details>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            className={iconBtnClass}
            onClick={() => {
              onSetFrozen(unit);
            }}
          >
            {unit.frozen ? "Unfreeze" : "Freeze"}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-blue-100/70">Rest day. No planned workout.</p>
      )}
    </div>
  );
}

export default function PlanCalendar({
  weekStart,
  visibleMonth,
  units,
  races,
  logs,
  error,
  warnings,
  busy,
  revisions,
  snapshotDirty,
  onPrevMonth,
  onNextMonth,
  onToday,
  onGenerate,
  onGenerateWeek,
  onSaveSnapshot,
  onRestore,
  onSaveUnit,
  onSaveLog,
  onUnlog,
  onSetFrozen,
  onDeleteUnit,
}: PlanCalendarProps) {
  const grid = monthGridDates(visibleMonth);
  const byDate = unitsByDate(units);
  const raceByDate = racesByDate(races);
  const logByDate = logsByDate(logs);
  const today = utcToday();
  const currentMonthVisible = utcMonthStart(visibleMonth) === utcMonthStart(today);
  const activeWeekHasUnits = weekHasUnits(units, weekStart);
  const hasHorizonUnit = hasUnitInHorizon(units, today, addUtcDays(today, 13));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const selectedHasUnit = selectedDate !== null && byDate.has(selectedDate);
  const selectedInMonth =
    selectedDate !== null && (utcMonthStart(selectedDate) === utcMonthStart(visibleMonth) || selectedHasUnit)
      ? selectedDate
      : null;
  const bleedMonday = grid[0];
  const showIsoWeekCaption = !isInVisibleMonth(bleedMonday, visibleMonth);

  useEffect(() => {
    if (selectedInMonth === null) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedDate(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedInMonth]);

  const selectedUnit = selectedInMonth === null ? undefined : byDate.get(selectedInMonth);
  const selectedRace = selectedInMonth === null ? undefined : raceByDate.get(selectedInMonth);
  const selectedLog = selectedInMonth === null ? undefined : logByDate.get(selectedInMonth);

  return (
    <section className="space-y-2 text-left">
      <div className="flex flex-wrap items-center gap-2 md:flex-nowrap">
        <h2 className="text-base font-semibold text-white">{formatMonthYear(visibleMonth)}</h2>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="icon"
            variant="outline"
            disabled={busy}
            className={iconBtnClass}
            onClick={onPrevMonth}
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy || currentMonthVisible}
            className={iconBtnClass}
            onClick={onToday}
            aria-current={currentMonthVisible ? "date" : undefined}
          >
            Today
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            disabled={busy}
            className={iconBtnClass}
            onClick={onNextMonth}
            aria-label="Next month"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <Button
          type="button"
          disabled={busy}
          className={cn("size-9 rounded-lg bg-purple-600 p-0 text-white hover:bg-purple-500 sm:h-9 sm:w-auto sm:px-4")}
          onClick={onGenerate}
          aria-label={generatePlanButtonLabel(false, hasHorizonUnit)}
        >
          <RefreshCw className="size-4 sm:hidden" aria-hidden="true" />
          <span className="hidden sm:inline">{generatePlanButtonLabel(busy, hasHorizonUnit)}</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          className={cn(iconBtnClass, "size-9 rounded-lg p-0 sm:h-9 sm:w-auto sm:px-4")}
          onClick={onGenerateWeek}
          aria-label={generateWeekButtonLabel(false, activeWeekHasUnits)}
        >
          <CalendarDays className="size-4 sm:hidden" aria-hidden="true" />
          <span className="hidden sm:inline">{generateWeekButtonLabel(busy, activeWeekHasUnits)}</span>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy || !snapshotDirty}
          className={iconBtnClass}
          onClick={onSaveSnapshot}
        >
          Save snapshot
        </Button>
        {snapshotDirty ? <p className="text-xs text-blue-100/70">Unsaved changes</p> : null}
        {revisions.length > 0 ? (
          <select
            className={cn(fieldClass, "w-auto min-w-40")}
            disabled={busy}
            value=""
            aria-label="Restore"
            onChange={(event) => {
              const revisionId = event.target.value;
              if (revisionId) {
                onRestore(revisionId);
              }
            }}
          >
            <option value="" className="bg-slate-900">
              Restore
            </option>
            {revisions.map((revision) => (
              <option key={revision.id} value={revision.id} className="bg-slate-900">
                {formatRevisionLabel(revision.createdAt)}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <ServerError message={error} />
      {warnings.length > 0 ? (
        <ul className="space-y-1 text-sm text-amber-200/90">
          {warnings.map((warning) => (
            <li key={`${warning.severity}-${warning.code}-${warning.message}`}>{warning.message}</li>
          ))}
        </ul>
      ) : null}

      {!activeWeekHasUnits ? <p className="text-sm text-blue-100/70">No plan for this week yet.</p> : null}

      <LoadChartTabs weeks={aggregateLoadWeeks(units, logs, today)} days={aggregateDailyLoad(units, logs, today)} />

      {showIsoWeekCaption ? (
        <p className="text-xs text-blue-100/70">{formatIsoWeekIncludesCaption(bleedMonday)}</p>
      ) : null}

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_HEADERS.map((label) => (
          <p
            key={label}
            className="px-1 text-center text-[10px] font-semibold tracking-wide text-blue-100/60 uppercase"
          >
            {label}
          </p>
        ))}
        {grid.map((date) => {
          const inMonth = isInVisibleMonth(date, visibleMonth);
          const unit = byDate.get(date);
          const race = inMonth ? raceByDate.get(date) : undefined;
          const isToday = date === today;
          const dayNumber = Number(date.slice(8, 10));
          const selected = selectedInMonth === date;
          return (
            <article
              key={date}
              className={cn(
                "min-h-12 rounded-lg border border-white/10 bg-white/5 p-1 sm:min-h-20 sm:p-2",
                !inMonth && (unit ? "opacity-60" : "opacity-40"),
                isToday && "border-white/60",
                selected && "ring-2 ring-purple-400",
              )}
            >
              {inMonth || unit ? (
                <button
                  type="button"
                  className="block w-full rounded-md text-left"
                  aria-pressed={selected}
                  onClick={() => {
                    setSelectedDate((current) => (current === date ? null : date));
                  }}
                >
                  <DaySummary
                    dayNumber={dayNumber}
                    isToday={isToday}
                    unit={unit}
                    race={race}
                    log={logByDate.get(date)}
                    inMonth={inMonth}
                  />
                </button>
              ) : (
                <DaySummary
                  dayNumber={dayNumber}
                  isToday={isToday}
                  unit={undefined}
                  race={undefined}
                  log={undefined}
                  inMonth={false}
                />
              )}
            </article>
          );
        })}
      </div>

      {selectedInMonth !== null ? (
        <DayPanel
          key={selectedInMonth}
          date={selectedInMonth}
          unit={selectedUnit}
          race={selectedRace}
          log={selectedLog}
          busy={busy}
          onClose={() => {
            setSelectedDate(null);
          }}
          onSaveUnit={onSaveUnit}
          onSaveLog={onSaveLog}
          onUnlog={onUnlog}
          onSetFrozen={onSetFrozen}
          onDeleteUnit={onDeleteUnit}
        />
      ) : null}
    </section>
  );
}
