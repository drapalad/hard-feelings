import type { SupabaseClient } from "@supabase/supabase-js";
import { WEEKDAYS, type Profile, type ProfileView, type Weekday } from "@/types";

const SELECT_COLUMNS =
  "weekly_km, long_weekdays, rest_weekdays, mix_easy, mix_threshold, mix_speed, last_race_date, last_race_km, last_race_time_sec, coach_notes";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const PROFILE_PREF_DEFAULTS: Omit<Profile, "weeklyKm"> = {
  longWeekdays: ["sat"],
  restWeekdays: [],
  mixEasy: 70,
  mixThreshold: 20,
  mixSpeed: 10,
};

const LAST_RACE_UNSET = {
  lastRaceDate: null,
  lastRaceKm: null,
  lastRaceTimeSec: null,
} as const;

export interface LastRaceInput {
  lastRaceDate: string;
  lastRaceKm: number;
  lastRaceTimeSec: number;
}

export type UpdateLastRaceResult = { ok: true; profile: ProfileView } | { ok: false; code: "NOT_FOUND" };

interface ProfileRow {
  weekly_km: number | string | null;
  long_weekdays?: unknown;
  rest_weekdays?: unknown;
  mix_easy?: unknown;
  mix_threshold?: unknown;
  mix_speed?: unknown;
  last_race_date?: unknown;
  last_race_km?: unknown;
  last_race_time_sec?: unknown;
  coach_notes?: unknown;
}

function parseWeeklyKm(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function isWeekday(value: string): value is Weekday {
  return (WEEKDAYS as readonly string[]).includes(value);
}

function sortWeekdays(days: Weekday[]): Weekday[] {
  return WEEKDAYS.filter((day) => days.includes(day));
}

function uniqueWeekdays(days: Weekday[]): Weekday[] {
  return sortWeekdays([...new Set(days)]);
}

function parseWeekdayList(value: unknown): Weekday[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const parsed: Weekday[] = [];
  for (const item of value) {
    if (typeof item === "string" && isWeekday(item)) {
      parsed.push(item);
    }
  }
  return uniqueWeekdays(parsed);
}

function parseLongWeekdays(value: unknown): Weekday[] {
  const parsed = parseWeekdayList(value);
  return parsed.length === 0 ? PROFILE_PREF_DEFAULTS.longWeekdays : parsed;
}

function parseMixPct(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value !== "" ? Number(value) : NaN;
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
    return null;
  }
  return parsed;
}

function parseMix(row: ProfileRow): Pick<Profile, "mixEasy" | "mixThreshold" | "mixSpeed"> {
  const mixEasy = parseMixPct(row.mix_easy);
  const mixThreshold = parseMixPct(row.mix_threshold);
  const mixSpeed = parseMixPct(row.mix_speed);
  if (mixEasy === null || mixThreshold === null || mixSpeed === null) {
    return {
      mixEasy: PROFILE_PREF_DEFAULTS.mixEasy,
      mixThreshold: PROFILE_PREF_DEFAULTS.mixThreshold,
      mixSpeed: PROFILE_PREF_DEFAULTS.mixSpeed,
    };
  }
  return { mixEasy, mixThreshold, mixSpeed };
}

function parseLastRaceDate(value: unknown): string | null {
  if (typeof value !== "string" || !ISO_DATE.test(value)) {
    return null;
  }
  return value;
}

function parseLastRaceKm(value: unknown): number | null {
  const parsed = parseWeeklyKm(value);
  if (parsed === null || parsed <= 0) {
    return null;
  }
  return parsed;
}

function parseLastRaceTimeSec(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value !== "" ? Number(value) : NaN;
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function parseCoachNotes(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function parseLastRace(row: ProfileRow): Pick<ProfileView, "lastRaceDate" | "lastRaceKm" | "lastRaceTimeSec"> {
  const lastRaceDate = parseLastRaceDate(row.last_race_date);
  const lastRaceKm = parseLastRaceKm(row.last_race_km);
  const lastRaceTimeSec = parseLastRaceTimeSec(row.last_race_time_sec);
  if (lastRaceDate === null || lastRaceKm === null || lastRaceTimeSec === null) {
    return { ...LAST_RACE_UNSET };
  }
  return { lastRaceDate, lastRaceKm, lastRaceTimeSec };
}

function asProfileRow(data: unknown): ProfileRow | null {
  if (typeof data !== "object" || data === null || !("weekly_km" in data)) {
    return null;
  }
  const weeklyKm = data.weekly_km;
  if (weeklyKm !== null && typeof weeklyKm !== "number" && typeof weeklyKm !== "string") {
    return null;
  }
  return data as ProfileRow;
}

function toProfileView(row: ProfileRow, weeklyKm: number | null): ProfileView {
  return {
    weeklyKm,
    longWeekdays: parseLongWeekdays(row.long_weekdays),
    restWeekdays: parseWeekdayList(row.rest_weekdays),
    ...parseMix(row),
    ...parseLastRace(row),
    coachNotes: parseCoachNotes(row.coach_notes),
  };
}

function emptyProfileView(): ProfileView {
  return { weeklyKm: null, ...PROFILE_PREF_DEFAULTS, ...LAST_RACE_UNSET, coachNotes: null };
}

export async function getProfile(client: SupabaseClient, userId: string): Promise<ProfileView> {
  const { data, error } = await client.from("profiles").select(SELECT_COLUMNS).eq("user_id", userId).maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  const row = asProfileRow(data);
  if (row === null) {
    return emptyProfileView();
  }
  return toProfileView(row, parseWeeklyKm(row.weekly_km));
}

export async function upsertProfile(
  client: SupabaseClient,
  userId: string,
  profile: Omit<Profile, "weeklyKm"> & { weeklyKm: number | null; coachNotes?: string | null },
): Promise<ProfileView> {
  const longWeekdays = uniqueWeekdays(profile.longWeekdays);
  const restWeekdays = uniqueWeekdays(profile.restWeekdays);
  const payload = {
    user_id: userId,
    weekly_km: profile.weeklyKm,
    long_weekdays: longWeekdays,
    rest_weekdays: restWeekdays,
    mix_easy: profile.mixEasy,
    mix_threshold: profile.mixThreshold,
    mix_speed: profile.mixSpeed,
    ...("coachNotes" in profile ? { coach_notes: profile.coachNotes } : {}),
  };
  const { data, error } = await client
    .from("profiles")
    .upsert(payload, { onConflict: "user_id" })
    .select(SELECT_COLUMNS)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  const row = asProfileRow(data);
  if (row === null) {
    throw new Error("Failed to save profile");
  }
  return toProfileView(row, parseWeeklyKm(row.weekly_km));
}

export async function updateLastRace(
  client: SupabaseClient,
  userId: string,
  lastRace: LastRaceInput,
): Promise<UpdateLastRaceResult> {
  const { data, error } = await client
    .from("profiles")
    .update({
      last_race_date: lastRace.lastRaceDate,
      last_race_km: lastRace.lastRaceKm,
      last_race_time_sec: lastRace.lastRaceTimeSec,
    })
    .eq("user_id", userId)
    .select(SELECT_COLUMNS)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  const row = asProfileRow(data);
  if (row === null) {
    return { ok: false, code: "NOT_FOUND" };
  }
  return { ok: true, profile: toProfileView(row, parseWeeklyKm(row.weekly_km)) };
}
