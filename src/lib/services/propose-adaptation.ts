import { inclusiveIsoDates, weekDates } from "@/lib/dates";
import type {
  PendingRacesPatch,
  ProfilePatch,
  Race,
  RacePriority,
  TrainingUnit,
  UnitMutation,
  WorkoutType,
  WorkoutLog,
  ProfileView,
} from "@/types";

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

const WORKOUT_TYPES: WorkoutType[] = ["base", "recovery", "tempo", "threshold", "anaerobic", "long"];

const TYPE_RANK: Record<WorkoutType, number> = {
  long: 6,
  anaerobic: 5,
  threshold: 4,
  tempo: 3,
  base: 2,
  recovery: 1,
};

const PURPOSE: Record<WorkoutType, string> = {
  base: "aerobic foundation",
  recovery: "easy absorption",
  tempo: "comfortably hard",
  threshold: "lactate-threshold work",
  anaerobic: "short hard repeats",
  long: "endurance for the A race",
};

const ISO_DATE = /\b(\d{4}-\d{2}-\d{2})\b/;
const SET_KM =
  /\bmake\s+(\d{4}-\d{2}-\d{2}|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(\d+(?:\.\d+)?)\s*km\b/i;
const CHANGE_TYPE = /\b(make|change|set|turn)\b/i;
const EXPLAIN = /\bwhat\b/i;
const LIFE = /\b(sleep|tired|exhausted|sick|ill|busy|stressed)\b/i;
const LOG = /\b(completed|logged|log|done)\b/i;
const LOG_KM = /(\d+(?:\.\d+)?)\s*km\b/i;

export interface ProposeInput {
  message: string;
  weekStart: string;
  units: TrainingUnit[];
  weeklyKm?: number;
  history?: { role: "user" | "assistant"; content: string }[];
  createFrom?: string;
  createTo?: string;
}

export interface ProposeResult {
  reply: string;
  mutations: UnitMutation[];
  log?: { date: string; distanceKm?: number };
  profile?: ProfilePatch;
  freeze?: string[];
  unfreeze?: string[];
  races?: PendingRacesPatch;
}

export interface RawProposeMutation {
  date: string;
  type?: string | null;
  distanceKm?: number | null;
  structure?: string | null;
  delete?: boolean | null;
}

export interface RawProposeResult {
  reply: string;
  mutations: RawProposeMutation[];
  log?: { date: string; distanceKm?: number | null } | null;
  profile?: Partial<Record<keyof ProfilePatch, unknown>> | null;
  freeze?: string[] | null;
  unfreeze?: string[] | null;
  races?: PendingRacesPatch | null;
}

const UNKNOWN_DAY_REPLY = "I don't see a workout on that day.";
const STRICT_ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isWorkoutType(value: unknown): value is WorkoutType {
  return typeof value === "string" && WORKOUT_TYPES.includes(value as WorkoutType);
}

export interface ProposeHorizon {
  createFrom: string;
  createTo: string;
}

export function sanitizeProposeResult(
  raw: RawProposeResult,
  units: TrainingUnit[],
  horizon?: ProposeHorizon,
): ProposeResult {
  const dates = new Set(units.map((unit) => unit.date));
  if (horizon !== undefined) {
    for (const date of inclusiveIsoDates(horizon.createFrom, horizon.createTo)) {
      dates.add(date);
    }
  }
  const unitDates = new Set(units.map((unit) => unit.date));
  const mutations: UnitMutation[] = [];

  for (const mutation of raw.mutations) {
    if (typeof mutation.date !== "string" || !STRICT_ISO_DATE.test(mutation.date)) {
      continue;
    }
    const isCreate = mutation.delete !== true && isWorkoutType(mutation.type) && mutation.distanceKm != null;
    if (!dates.has(mutation.date) && !isCreate) {
      continue;
    }
    if (mutation.type != null && !isWorkoutType(mutation.type)) {
      continue;
    }
    if (mutation.distanceKm != null && (!Number.isFinite(mutation.distanceKm) || mutation.distanceKm < 0)) {
      continue;
    }
    const next: UnitMutation = { date: mutation.date };
    if (mutation.delete === true) {
      next.delete = true;
      mutations.push(next);
      continue;
    }
    if (isWorkoutType(mutation.type)) {
      next.type = mutation.type;
    }
    if (mutation.distanceKm != null) {
      next.distanceKm = mutation.distanceKm;
    }
    if (typeof mutation.structure === "string" && mutation.structure !== "") {
      next.structure = mutation.structure;
    }
    mutations.push(next);
  }

  let log: ProposeResult["log"];
  const rawLog = raw.log;
  if (rawLog != null && unitDates.has(rawLog.date)) {
    log = { date: rawLog.date };
    if (rawLog.distanceKm != null && Number.isFinite(rawLog.distanceKm) && rawLog.distanceKm >= 0) {
      log.distanceKm = rawLog.distanceKm;
    }
  }

  if (log !== undefined) {
    const profile = raw.profile == null ? undefined : (raw.profile as ProfilePatch);
    return {
      reply: raw.reply,
      mutations: [],
      log,
      ...(profile === undefined ? {} : { profile }),
      ...(Array.isArray(raw.freeze) ? { freeze: raw.freeze } : {}),
      ...(Array.isArray(raw.unfreeze) ? { unfreeze: raw.unfreeze } : {}),
      ...(raw.races != null ? { races: raw.races } : {}),
    };
  }

  const droppedUnknownLog = rawLog != null && !unitDates.has(rawLog.date);
  const profile = raw.profile == null ? undefined : (raw.profile as ProfilePatch);
  return {
    reply: droppedUnknownLog && mutations.length === 0 ? UNKNOWN_DAY_REPLY : raw.reply,
    mutations,
    ...(profile === undefined ? {} : { profile }),
    ...(Array.isArray(raw.freeze) ? { freeze: raw.freeze } : {}),
    ...(Array.isArray(raw.unfreeze) ? { unfreeze: raw.unfreeze } : {}),
    ...(raw.races != null ? { races: raw.races } : {}),
  };
}

export const COACH_UNAVAILABLE_REPLY = "I couldn't reach the coach just now. Try again in a moment.";

export type ProposeCompleteFn = (request: {
  message: string;
  weekStart: string;
  units: TrainingUnit[];
  weeklyKm: number;
  history: { role: "user" | "assistant"; content: string }[];
  createFrom?: string;
  createTo?: string;
  profile?: ProfileView;
  currentLoad?: { from: string; to: string; plannedKm: number; loggedKm: number };
  isoWeeks?: { monday: string; plannedKm: number; loggedKm: number; dates: string[] }[];
  extra?: {
    range?: { from: string; to: string };
    units?: TrainingUnit[];
    logs?: WorkoutLog[];
    races?: Race[];
  };
  races?: { id: string; date: string; priority: RacePriority; name?: string; goal?: string }[];
}) => Promise<ProposeResult & { dataRequest?: { from: string; to: string } | null }>;

export interface ProposeDeps {
  complete?: ProposeCompleteFn;
}

export function toRawProposeResult(result: ProposeResult): RawProposeResult {
  return {
    reply: result.reply,
    mutations: result.mutations.map((mutation) => ({
      date: mutation.date,
      type: mutation.type ?? null,
      distanceKm: mutation.distanceKm ?? null,
      structure: mutation.structure ?? null,
      ...(mutation.delete === true ? { delete: true } : {}),
    })),
    log: result.log === undefined ? null : { date: result.log.date, distanceKm: result.log.distanceKm ?? null },
    profile: result.profile ?? null,
    freeze: result.freeze ?? null,
    unfreeze: result.unfreeze ?? null,
    races: result.races ?? null,
  };
}

function proposeHorizon(input: Pick<ProposeInput, "createFrom" | "createTo">): ProposeHorizon | undefined {
  if (input.createFrom === undefined || input.createTo === undefined) {
    return undefined;
  }
  return { createFrom: input.createFrom, createTo: input.createTo };
}

export async function proposeAdaptation(input: ProposeInput, deps?: ProposeDeps): Promise<ProposeResult> {
  if (deps?.complete) {
    try {
      const result = await deps.complete({
        message: input.message,
        weekStart: input.weekStart,
        units: input.units,
        weeklyKm: input.weeklyKm ?? 0,
        history: input.history ?? [{ role: "user", content: input.message }],
        createFrom: input.createFrom,
        createTo: input.createTo,
      });
      return sanitizeProposeResult(toRawProposeResult(result), input.units, proposeHorizon(input));
    } catch (error) {
      // eslint-disable-next-line no-console -- chat UI is pinned; status belongs in the server log
      console.error("Coach LLM failed:", error instanceof Error ? error.message : error);
      return { reply: COACH_UNAVAILABLE_REPLY, mutations: [] };
    }
  }
  return stubProposeAdaptation(input);
}

export function stubProposeAdaptation(input: ProposeInput): ProposeResult {
  const message = input.message.trim();
  const dates = weekDates(input.weekStart);

  if (isExplain(message)) {
    return explainUnit(message, dates, input.units);
  }
  if (LOG.test(message)) {
    return logWorkout(message, dates, input.units);
  }
  if (LIFE.test(message)) {
    return lifeContext(input.units);
  }
  const kmMatch = SET_KM.exec(message);
  if (kmMatch) {
    return setKm(kmMatch[1], Number(kmMatch[2]), dates);
  }
  if (CHANGE_TYPE.test(message)) {
    const typeChange = changeType(message, dates);
    if (typeChange !== null) {
      return typeChange;
    }
  }
  return {
    reply:
      "I can explain a unit, take life context (for example poor sleep), change a day (type or km), or log a completed workout. Try “what is Tuesday for”, “poor sleep”, “make Wednesday a long”, or “I completed Tuesday”.",
    mutations: [],
  };
}

function logWorkout(message: string, dates: string[], units: TrainingUnit[]): ProposeResult {
  const date = resolveDate(message, dates);
  if (date === undefined) {
    return {
      reply: "Which day did you complete? Try “I completed Tuesday”.",
      mutations: [],
    };
  }
  const unit = units.find((item) => item.date === date);
  if (unit === undefined) {
    return { reply: "I don't see a workout on that day.", mutations: [] };
  }
  const kmMatch = LOG_KM.exec(message);
  const distanceKm = kmMatch === null ? undefined : Number(kmMatch[1]);
  if (distanceKm !== undefined && (!Number.isFinite(distanceKm) || distanceKm < 0)) {
    return { reply: "I could not tell which day or distance to log.", mutations: [] };
  }
  const km = distanceKm ?? unit.distanceKm;
  const log: { date: string; distanceKm?: number } = { date };
  if (distanceKm !== undefined) {
    log.distanceKm = distanceKm;
  }
  return {
    reply: `Logged ${date} as ${unit.type} ${km} km.`,
    mutations: [],
    log,
  };
}

function isExplain(message: string): boolean {
  if (/\bexplain\b/i.test(message)) {
    return true;
  }
  return EXPLAIN.test(message) && /\b(for|unit)\b/i.test(message);
}

function explainUnit(message: string, dates: string[], units: TrainingUnit[]): ProposeResult {
  const date = resolveDate(message, dates) ?? firstUnitDate(units);
  const unit = date === undefined ? undefined : units.find((item) => item.date === date);
  if (unit === undefined) {
    return { reply: "I don't see a workout on that day.", mutations: [] };
  }
  return {
    reply: `That ${unit.type} is ${unit.distanceKm} km — ${PURPOSE[unit.type]}.`,
    mutations: [],
  };
}

function lifeContext(units: TrainingUnit[]): ProposeResult {
  const unfrozen = units.filter((unit) => !unit.frozen);
  if (unfrozen.length === 0) {
    return { reply: "Frozen anchors cannot be changed this way.", mutations: [] };
  }
  const target = [...unfrozen].sort((a, b) => {
    const rank = TYPE_RANK[b.type] - TYPE_RANK[a.type];
    if (rank !== 0) {
      return rank;
    }
    if (b.distanceKm !== a.distanceKm) {
      return b.distanceKm - a.distanceKm;
    }
    return a.date.localeCompare(b.date);
  })[0];
  return {
    reply: `Given that life context, I would turn ${target.date} into recovery at half the distance.`,
    mutations: [{ date: target.date, type: "recovery", distanceKm: target.distanceKm * 0.5 }],
  };
}

function setKm(token: string, distanceKm: number, dates: string[]): ProposeResult {
  const date = resolveDate(token, dates);
  if (date === undefined || !Number.isFinite(distanceKm) || distanceKm < 0) {
    return { reply: "I could not tell which day or distance to change.", mutations: [] };
  }
  return {
    reply: `I would set ${date} to ${distanceKm} km.`,
    mutations: [{ date, distanceKm }],
  };
}

function changeType(message: string, dates: string[]): ProposeResult | null {
  const date = resolveDate(message, dates);
  const type = WORKOUT_TYPES.find((candidate) => new RegExp(`\\b${candidate}\\b`, "i").test(message));
  if (date === undefined || type === undefined) {
    return null;
  }
  return {
    reply: `I would change ${date} to ${type}.`,
    mutations: [{ date, type }],
  };
}

function resolveDate(text: string, dates: string[]): string | undefined {
  const iso = ISO_DATE.exec(text);
  if (iso && dates.includes(iso[1])) {
    return iso[1];
  }
  const lower = text.toLowerCase();
  for (let index = 0; index < WEEKDAYS.length; index++) {
    if (new RegExp(`\\b${WEEKDAYS[index]}\\b`).test(lower)) {
      return dates[index];
    }
  }
  return undefined;
}

function firstUnitDate(units: TrainingUnit[]): string | undefined {
  const sorted = [...units].sort((a, b) => a.date.localeCompare(b.date));
  return sorted[0]?.date;
}
