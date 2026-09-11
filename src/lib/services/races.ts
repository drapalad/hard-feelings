import type { SupabaseClient } from "@supabase/supabase-js";
import type { Race, RacePriority } from "@/types";
import { validateRaceList, RACE_LIST_ERROR_MESSAGES, type RaceListErrorCode } from "./profile-races";

export interface RaceWrite {
  date: string;
  priority: RacePriority;
  goal?: string;
  name?: string;
}

export type RaceMutationResult =
  | { ok: true; race: Race }
  | { ok: false; error: { code: RaceListErrorCode | "NOT_FOUND" | "DB_ERROR"; message: string } };

export type RaceDeleteResult = { ok: true } | { ok: false; error: { code: "NOT_FOUND" | "DB_ERROR"; message: string } };

function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function sortRacesUpcomingFirst(races: Race[], today = utcToday()): Race[] {
  const upcoming = races.filter((race) => race.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = races.filter((race) => race.date < today).sort((a, b) => a.date.localeCompare(b.date));
  return [...upcoming, ...past];
}

export function mapUniqueViolation(message: string): RaceListErrorCode {
  if (message.includes("races_one_a_per_user")) {
    return "SECOND_A_RACE";
  }
  return "DUPLICATE_RACE_DATE";
}

function isPriority(value: unknown): value is RacePriority {
  return value === "A" || value === "B" || value === "C" || value === "D";
}

function optionalText(value: unknown): string | undefined {
  if (typeof value !== "string" || value === "") {
    return undefined;
  }
  return value;
}

function asRace(data: unknown): Race | null {
  if (typeof data !== "object" || data === null) {
    return null;
  }
  if (!("id" in data) || !("date" in data) || !("priority" in data)) {
    return null;
  }
  if (typeof data.id !== "string" || typeof data.date !== "string" || !isPriority(data.priority)) {
    return null;
  }
  const race: Race = { id: data.id, date: data.date, priority: data.priority };
  const goal = "goal" in data ? optionalText(data.goal) : undefined;
  const name = "name" in data ? optionalText(data.name) : undefined;
  if (goal !== undefined) {
    race.goal = goal;
  }
  if (name !== undefined) {
    race.name = name;
  }
  return race;
}

function asRaceList(data: unknown): Race[] {
  if (!Array.isArray(data)) {
    return [];
  }
  return data.flatMap((row) => {
    const race = asRace(row);
    return race === null ? [] : [race];
  });
}

function uniqueError(error: { code?: string; message?: string }): RaceListErrorCode | null {
  if (error.code !== "23505") {
    return null;
  }
  return mapUniqueViolation(error.message ?? "");
}

function writeRow(userId: string, write: RaceWrite) {
  return {
    user_id: userId,
    date: write.date,
    priority: write.priority,
    goal: write.goal ?? null,
    name: write.name ?? null,
  };
}

export async function listRaces(client: SupabaseClient, userId: string): Promise<Race[]> {
  const { data, error } = await client.from("races").select("id, date, priority, goal, name").eq("user_id", userId);
  if (error) {
    throw new Error(error.message);
  }
  return sortRacesUpcomingFirst(asRaceList(data));
}

export async function insertRace(
  client: SupabaseClient,
  userId: string,
  write: RaceWrite,
): Promise<RaceMutationResult> {
  const existing = await listRaces(client, userId);
  const invariants = validateRaceList([...existing, { date: write.date, priority: write.priority }]);
  if (!invariants.ok) {
    return invariants;
  }

  const { data, error } = await client
    .from("races")
    .insert(writeRow(userId, write))
    .select("id, date, priority, goal, name")
    .single();
  if (error) {
    const code = uniqueError(error);
    if (code !== null) {
      return { ok: false, error: { code, message: RACE_LIST_ERROR_MESSAGES[code] } };
    }
    return { ok: false, error: { code: "DB_ERROR", message: error.message } };
  }
  const race = asRace(data);
  if (race === null) {
    return { ok: false, error: { code: "DB_ERROR", message: "Failed to create race" } };
  }
  return { ok: true, race };
}

export async function updateRace(
  client: SupabaseClient,
  userId: string,
  id: string,
  write: RaceWrite,
): Promise<RaceMutationResult> {
  const existing = await listRaces(client, userId);
  if (!existing.some((race) => race.id === id)) {
    return { ok: false, error: { code: "NOT_FOUND", message: "Race not found" } };
  }
  const next = existing.map((race) =>
    race.id === id ? { ...race, date: write.date, priority: write.priority } : race,
  );
  const invariants = validateRaceList(next);
  if (!invariants.ok) {
    return invariants;
  }

  const { data, error } = await client
    .from("races")
    .update(writeRow(userId, write))
    .eq("id", id)
    .eq("user_id", userId)
    .select("id, date, priority, goal, name")
    .maybeSingle();
  if (error) {
    const code = uniqueError(error);
    if (code !== null) {
      return { ok: false, error: { code, message: RACE_LIST_ERROR_MESSAGES[code] } };
    }
    return { ok: false, error: { code: "DB_ERROR", message: error.message } };
  }
  const race = asRace(data);
  if (race === null) {
    return { ok: false, error: { code: "NOT_FOUND", message: "Race not found" } };
  }
  return { ok: true, race };
}

export async function deleteRace(client: SupabaseClient, userId: string, id: string): Promise<RaceDeleteResult> {
  const { data, error } = await client.from("races").delete().eq("id", id).eq("user_id", userId).select("id");
  if (error) {
    return { ok: false, error: { code: "DB_ERROR", message: error.message } };
  }
  if (!Array.isArray(data) || data.length === 0) {
    return { ok: false, error: { code: "NOT_FOUND", message: "Race not found" } };
  }
  return { ok: true };
}
