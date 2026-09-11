import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { roundKm } from "@/lib/km";
import { createMemorySupabase, type MemoryRow } from "@/lib/test/memory-supabase";
import { MAX_PLAN_GET_RANGE_DAYS, resolvePlanRange } from "@/lib/services/plan";
import { POST as planPost, GET as planGet } from "./plan";
import { PUT as unitsPut, DELETE as unitsDelete } from "./plan/units";
import { POST as logsPost } from "./plan/logs";

const { harness } = vi.hoisted(() => {
  const state: { client: SupabaseClient | null } = { client: null };
  return {
    harness: {
      state,
      createClient: () => state.client,
    },
  };
});

vi.mock("astro:env/server", () => ({
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_KEY: "anon-key",
  OPENAI_API_KEY: "",
  OPENAI_MODEL: "",
}));

vi.mock("@/lib/supabase", () => ({
  createClient: harness.createClient,
}));

const SESSION = "member-session";
const VICTIM = "member-other";
const MONDAY = "2026-08-10";
const WEEKLY_KM = 50;

type RouteHandler = typeof planPost;

function signedInContext(method: string, path: string, body?: unknown): Parameters<RouteHandler>[0] {
  const url = new URL(`http://localhost${path}`);
  const init: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  return {
    locals: { user: { id: SESSION }, isAdmin: false },
    request: new Request(url, init),
    url,
  } as Parameters<RouteHandler>[0];
}

function asRows(data: unknown): MemoryRow[] {
  if (!Array.isArray(data)) {
    return [];
  }
  return data.filter((row): row is MemoryRow => typeof row === "object" && row !== null);
}

async function tableRows(client: SupabaseClient, table: "training_units" | "workout_logs"): Promise<MemoryRow[]> {
  const { data, error } = await client.from(table).select("*");
  expect(error).toBeNull();
  return asRows(data);
}

function expectStoredWeekVolume(rows: MemoryRow[], userId: string, weeklyKm: number) {
  const mine = rows.filter((row) => row.user_id === userId);
  const totalKm = roundKm(mine.reduce((sum, row) => sum + Number(row.distance_km), 0));
  expect(totalKm).toBe(roundKm(weeklyKm));
}

function validationErrorCode(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null || !("error" in body)) {
    return undefined;
  }
  const error = body.error;
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }
  return typeof error.code === "string" ? error.code : undefined;
}

const VICTIM_UNIT: MemoryRow = {
  user_id: VICTIM,
  date: MONDAY,
  type: "long",
  distance_km: 42,
  structure: "victim-monday",
  frozen: false,
};

const SESSION_UNIT: MemoryRow = {
  user_id: SESSION,
  date: MONDAY,
  type: "base",
  distance_km: 8,
  structure: null,
  frozen: false,
};

describe("risk #5 API contracts: plan/log mutation surface", () => {
  beforeEach(() => {
    harness.state.client = null;
  });

  it("POST /api/plan persists a week whose stored volume matches declared weekly km", async () => {
    const client = createMemorySupabase({
      profiles: [{ user_id: SESSION, weekly_km: WEEKLY_KM }],
      races: [{ id: "a-race", user_id: SESSION, date: "2026-10-04", priority: "A", name: "Berlin" }],
      training_units: [VICTIM_UNIT],
    });
    harness.state.client = client;

    const response = await planPost(signedInContext("POST", "/api/plan", { weekStart: MONDAY }));
    expect(response.status).toBe(200);

    const stored = await tableRows(client, "training_units");
    const sessionUnits = stored.filter((row) => row.user_id === SESSION);
    expect(sessionUnits.length).toBeGreaterThan(0);
    expectStoredWeekVolume(stored, SESSION, WEEKLY_KM);
    expect(stored).toEqual(expect.arrayContaining([expect.objectContaining(VICTIM_UNIT)]));
  });

  it("PUT /api/plan/units rejects negative km and unknown type without changing stored units", async () => {
    const client = createMemorySupabase({
      training_units: [SESSION_UNIT, VICTIM_UNIT],
    });
    harness.state.client = client;
    const before = await tableRows(client, "training_units");

    const negative = await unitsPut(
      signedInContext("PUT", "/api/plan/units", { date: MONDAY, type: "tempo", distanceKm: -1 }),
    );
    expect(negative.status).toBe(400);
    expect(validationErrorCode(await negative.json())).toBe("VALIDATION_ERROR");

    const unknownType = await unitsPut(
      signedInContext("PUT", "/api/plan/units", { date: MONDAY, type: "easy", distanceKm: 8 }),
    );
    expect(unknownType.status).toBe(400);
    expect(validationErrorCode(await unknownType.json())).toBe("VALIDATION_ERROR");

    expect(await tableRows(client, "training_units")).toEqual(before);
  });

  it("PUT /api/plan/units ignores extra owner fields and persists as the session user", async () => {
    const client = createMemorySupabase({
      profiles: [{ user_id: SESSION, weekly_km: WEEKLY_KM }],
      training_units: [SESSION_UNIT, VICTIM_UNIT],
    });
    harness.state.client = client;

    const response = await unitsPut(
      signedInContext("PUT", "/api/plan/units", {
        date: MONDAY,
        type: "tempo",
        distanceKm: 9,
        userId: VICTIM,
        user_id: VICTIM,
      }),
    );
    expect(response.status).toBe(200);

    const stored = await tableRows(client, "training_units");
    const sessionRow = stored.find((row) => row.user_id === SESSION && row.date === MONDAY);
    expect(sessionRow).toEqual(
      expect.objectContaining({ user_id: SESSION, date: MONDAY, type: "tempo", distance_km: 9 }),
    );
    expect(stored.filter((row) => row.user_id === VICTIM)).toEqual([expect.objectContaining(VICTIM_UNIT)]);
    expect(stored.some((row) => row.user_id === VICTIM && row.type === "tempo" && row.distance_km === 9)).toBe(false);
  });

  it("DELETE /api/plan/units rejects a bad date without changing stored units", async () => {
    const client = createMemorySupabase({
      training_units: [SESSION_UNIT, VICTIM_UNIT],
    });
    harness.state.client = client;
    const before = await tableRows(client, "training_units");

    const missing = await unitsDelete(signedInContext("DELETE", "/api/plan/units"));
    expect(missing.status).toBe(400);
    expect(validationErrorCode(await missing.json())).toBe("VALIDATION_ERROR");

    const invalid = await unitsDelete(signedInContext("DELETE", "/api/plan/units?date=13-08-2026"));
    expect(invalid.status).toBe(400);
    expect(validationErrorCode(await invalid.json())).toBe("VALIDATION_ERROR");

    expect(await tableRows(client, "training_units")).toEqual(before);
  });

  it("DELETE /api/plan/units ignores extra owner fields and removes the session row", async () => {
    const client = createMemorySupabase({
      profiles: [{ user_id: SESSION, weekly_km: WEEKLY_KM }],
      training_units: [SESSION_UNIT, VICTIM_UNIT],
    });
    harness.state.client = client;

    const missingUnit = await unitsDelete(signedInContext("DELETE", "/api/plan/units?date=2026-08-11"));
    expect(missingUnit.status).toBe(404);

    const response = await unitsDelete(
      signedInContext("DELETE", `/api/plan/units?date=${MONDAY}&userId=${VICTIM}&user_id=${VICTIM}`),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { changed: boolean; units: { date: string; distanceKm: number }[] };
    expect(body.changed).toBe(true);
    expect(body.units.find((unit) => unit.date === MONDAY)).toBeUndefined();
    expect(body.units.some((unit) => unit.distanceKm === 0)).toBe(false);

    const stored = await tableRows(client, "training_units");
    expect(stored.find((row) => row.user_id === SESSION && row.date === MONDAY)).toBeUndefined();
    expect(stored.some((row) => row.user_id === SESSION && Number(row.distance_km) === 0)).toBe(false);
    expect(stored.filter((row) => row.user_id === VICTIM)).toEqual([expect.objectContaining(VICTIM_UNIT)]);
  });

  it("PUT /api/plan/units persists stages jsonb and rejects an unknown kind", async () => {
    const client = createMemorySupabase({
      profiles: [{ user_id: SESSION, weekly_km: WEEKLY_KM }],
      training_units: [SESSION_UNIT, VICTIM_UNIT],
    });
    harness.state.client = client;
    const stages = [
      { kind: "warmup", label: "WU", duration: "2 km", target: "" },
      { kind: "work", label: "", duration: "5 km", target: "4:20" },
      { kind: "cooldown", label: "CD", duration: "2 km", target: "" },
    ];

    const ok = await unitsPut(
      signedInContext("PUT", "/api/plan/units", {
        date: MONDAY,
        type: "tempo",
        distanceKm: 9,
        stages,
        userId: VICTIM,
      }),
    );
    expect(ok.status).toBe(200);
    const stored = await tableRows(client, "training_units");
    const sessionRow = stored.find((row) => row.user_id === SESSION && row.date === MONDAY);
    expect(sessionRow).toEqual(expect.objectContaining({ user_id: SESSION, type: "tempo", distance_km: 9, stages }));
    expect(stored.filter((row) => row.user_id === VICTIM)).toEqual([expect.objectContaining(VICTIM_UNIT)]);

    const before = await tableRows(client, "training_units");
    const invalid = await unitsPut(
      signedInContext("PUT", "/api/plan/units", {
        date: MONDAY,
        type: "tempo",
        distanceKm: 9,
        stages: [{ kind: "easy", label: "WU", duration: "2 km", target: "" }],
      }),
    );
    expect(invalid.status).toBe(400);
    expect(validationErrorCode(await invalid.json())).toBe("VALIDATION_ERROR");
    expect(await tableRows(client, "training_units")).toEqual(before);
  });

  it("POST /api/plan/logs ignores extra owner and type and copies type from the planned unit", async () => {
    const client = createMemorySupabase({
      training_units: [SESSION_UNIT, VICTIM_UNIT],
    });
    harness.state.client = client;

    const response = await logsPost(
      signedInContext("POST", "/api/plan/logs", {
        date: MONDAY,
        userId: VICTIM,
        type: "long",
      }),
    );
    expect(response.status).toBe(200);

    const stored = await tableRows(client, "workout_logs");
    expect(stored).toEqual([
      expect.objectContaining({
        user_id: SESSION,
        date: MONDAY,
        type: "base",
        distance_km: 8,
      }),
    ]);
    expect(stored.some((row) => row.user_id === VICTIM)).toBe(false);
    expect(stored.some((row) => row.type === "long")).toBe(false);
  });

  it("POST /api/plan/logs rejects negative km and inserts no log", async () => {
    const client = createMemorySupabase({
      training_units: [SESSION_UNIT],
    });
    harness.state.client = client;

    const response = await logsPost(signedInContext("POST", "/api/plan/logs", { date: MONDAY, distanceKm: -1 }));
    expect(response.status).toBe(400);
    expect(validationErrorCode(await response.json())).toBe("VALIDATION_ERROR");
    expect(await tableRows(client, "workout_logs")).toEqual([]);
  });

  it("GET /api/plan without from/to returns one week of session units and logs", async () => {
    const nextWeekUnit: MemoryRow = {
      user_id: SESSION,
      date: "2026-08-17",
      type: "long",
      distance_km: 20,
      structure: null,
      frozen: false,
    };
    const sessionLog: MemoryRow = {
      user_id: SESSION,
      date: MONDAY,
      type: "base",
      distance_km: 8,
    };
    const client = createMemorySupabase({
      training_units: [SESSION_UNIT, nextWeekUnit, VICTIM_UNIT],
      workout_logs: [sessionLog],
    });
    harness.state.client = client;

    const response = await planGet(signedInContext("GET", `/api/plan?weekStart=${MONDAY}`));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { units: { date: string }[]; logs: { date: string }[] };
    expect(body.units.map((unit) => unit.date)).toEqual([MONDAY]);
    expect(body.logs.map((log) => log.date)).toEqual([MONDAY]);
    expect(JSON.stringify(body)).not.toContain("victim-monday");
  });

  it("GET /api/plan with from/to returns session rows in the window and not another member", async () => {
    const laterUnit: MemoryRow = {
      user_id: SESSION,
      date: "2026-08-17",
      type: "tempo",
      distance_km: 10,
      structure: "session-later",
      frozen: false,
    };
    const laterLog: MemoryRow = {
      user_id: SESSION,
      date: "2026-08-17",
      type: "tempo",
      distance_km: 10,
    };
    const client = createMemorySupabase({
      training_units: [SESSION_UNIT, laterUnit, VICTIM_UNIT],
      workout_logs: [laterLog],
    });
    harness.state.client = client;

    const response = await planGet(
      signedInContext("GET", `/api/plan?weekStart=${MONDAY}&from=${MONDAY}&to=2026-08-23`),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      units: { date: string; structure?: string }[];
      logs: { date: string }[];
    };
    expect(body.units.map((unit) => unit.date).sort()).toEqual([MONDAY, "2026-08-17"]);
    expect(body.logs.map((log) => log.date)).toEqual(["2026-08-17"]);
    expect(body.units.some((unit) => unit.structure === "victim-monday")).toBe(false);
    expect(JSON.stringify(body)).not.toContain("victim-monday");
    const stored = await tableRows(client, "training_units");
    expect(stored).toEqual(expect.arrayContaining([expect.objectContaining(VICTIM_UNIT)]));
  });

  it("resolvePlanRange accepts 56 inclusive days and rejects 57", () => {
    expect(MAX_PLAN_GET_RANGE_DAYS).toBe(56);
    expect(resolvePlanRange("2026-08-01", "2026-09-25")).toEqual({
      ok: true,
      kind: "range",
      from: "2026-08-01",
      to: "2026-09-25",
    });
    expect(resolvePlanRange("2026-08-01", "2026-09-26")).toEqual({ ok: false });
  });

  it("GET /api/plan with a 56-day window returns session edge dates and not another member", async () => {
    const fromUnit: MemoryRow = {
      user_id: SESSION,
      date: "2026-08-01",
      type: "recovery",
      distance_km: 6,
      structure: "session-from",
      frozen: false,
    };
    const toUnit: MemoryRow = {
      user_id: SESSION,
      date: "2026-09-25",
      type: "tempo",
      distance_km: 9,
      structure: "session-to",
      frozen: false,
    };
    const client = createMemorySupabase({
      training_units: [SESSION_UNIT, fromUnit, toUnit, VICTIM_UNIT],
    });
    harness.state.client = client;

    const response = await planGet(
      signedInContext("GET", `/api/plan?weekStart=${MONDAY}&from=2026-08-01&to=2026-09-25`),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { units: { date: string; structure?: string }[] };
    expect(body.units.map((row) => row.date).sort()).toEqual(["2026-08-01", MONDAY, "2026-09-25"]);
    expect(body.units.some((row) => row.structure === "victim-monday")).toBe(false);
    expect(JSON.stringify(body)).not.toContain("victim-monday");
  });

  it("GET /api/plan rejects unpaired from, reversed range, 57-day span, and non-ISO dates", async () => {
    const client = createMemorySupabase({
      training_units: [SESSION_UNIT, VICTIM_UNIT],
    });
    harness.state.client = client;
    const before = await tableRows(client, "training_units");

    const unpaired = await planGet(signedInContext("GET", `/api/plan?weekStart=${MONDAY}&from=${MONDAY}`));
    expect(unpaired.status).toBe(400);
    expect(validationErrorCode(await unpaired.json())).toBe("VALIDATION_ERROR");

    const reversed = await planGet(
      signedInContext("GET", `/api/plan?weekStart=${MONDAY}&from=2026-08-20&to=${MONDAY}`),
    );
    expect(reversed.status).toBe(400);
    expect(validationErrorCode(await reversed.json())).toBe("VALIDATION_ERROR");

    const tooLong = await planGet(
      signedInContext("GET", `/api/plan?weekStart=${MONDAY}&from=2026-08-01&to=2026-09-26`),
    );
    expect(tooLong.status).toBe(400);
    expect(validationErrorCode(await tooLong.json())).toBe("VALIDATION_ERROR");

    const invalid = await planGet(
      signedInContext("GET", `/api/plan?weekStart=${MONDAY}&from=13-08-2026&to=2026-08-16`),
    );
    expect(invalid.status).toBe(400);
    expect(validationErrorCode(await invalid.json())).toBe("VALIDATION_ERROR");

    expect(await tableRows(client, "training_units")).toEqual(before);
  });
});
