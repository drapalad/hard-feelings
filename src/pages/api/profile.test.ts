import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createMemorySupabase, type MemoryRow } from "@/lib/test/memory-supabase";
import { GET as profileGet, PATCH as profilePatch, PUT as profilePut } from "./profile";

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

type RouteHandler = typeof profileGet;

function context(method: string, body?: unknown, userId: string | null = SESSION): Parameters<RouteHandler>[0] {
  const url = new URL("http://localhost/api/profile");
  const init: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  return {
    locals: { user: userId === null ? null : { id: userId }, isAdmin: false },
    request: new Request(url, init),
    url,
  } as Parameters<RouteHandler>[0];
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

async function tableRows(client: SupabaseClient): Promise<MemoryRow[]> {
  const { data, error } = await client.from("profiles").select("*");
  expect(error).toBeNull();
  if (!Array.isArray(data)) {
    return [];
  }
  return data.filter((row): row is MemoryRow => typeof row === "object" && row !== null);
}

const VALID_BODY = {
  weeklyKm: 50,
  longWeekdays: ["sat", "sun"],
  restWeekdays: ["mon"],
  mixEasy: 60,
  mixThreshold: 30,
  mixSpeed: 10,
};

const LAST_RACE_UNSET = {
  lastRaceDate: null,
  lastRaceKm: null,
  lastRaceTimeSec: null,
};

const COACH_NOTES_UNSET = { coachNotes: null as string | null };

const VALID_VIEW = { ...VALID_BODY, ...LAST_RACE_UNSET, ...COACH_NOTES_UNSET };

const VALID_LAST_RACE = {
  lastRaceDate: "2026-04-12",
  lastRaceKm: 10,
  lastRaceTimeSec: 2490,
};

describe("profile GET/PUT contracts", () => {
  beforeEach(() => {
    harness.state.client = null;
  });

  it("returns 401 UNAUTHORIZED JSON for logged-out GET and PUT", async () => {
    const getResponse = await profileGet(context("GET", undefined, null));
    expect(getResponse.status).toBe(401);
    expect(getResponse.headers.get("Location")).toBeNull();
    expect(await getResponse.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "Sign in required" },
    });

    const putResponse = await profilePut(context("PUT", VALID_BODY, null));
    expect(putResponse.status).toBe(401);
    expect(putResponse.headers.get("Location")).toBeNull();
    expect(await putResponse.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "Sign in required" },
    });

    const patchResponse = await profilePatch(context("PATCH", VALID_LAST_RACE, null));
    expect(patchResponse.status).toBe(401);
    expect(patchResponse.headers.get("Location")).toBeNull();
    expect(await patchResponse.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "Sign in required" },
    });
  });

  it("GET with no row returns weeklyKm null and SQL prefs defaults", async () => {
    harness.state.client = createMemorySupabase();
    const response = await profileGet(context("GET"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      weeklyKm: null,
      longWeekdays: ["sat"],
      restWeekdays: [],
      mixEasy: 70,
      mixThreshold: 20,
      mixSpeed: 10,
      ...LAST_RACE_UNSET,
      ...COACH_NOTES_UNSET,
    });
  });

  it("PUT round-trips prefs on GET and in the store", async () => {
    const client = createMemorySupabase();
    harness.state.client = client;

    const putResponse = await profilePut(context("PUT", VALID_BODY));
    expect(putResponse.status).toBe(200);
    expect(await putResponse.json()).toEqual(VALID_VIEW);

    const getResponse = await profileGet(context("GET"));
    expect(await getResponse.json()).toEqual(VALID_VIEW);

    const stored = await tableRows(client);
    expect(stored).toEqual([
      expect.objectContaining({
        user_id: SESSION,
        weekly_km: 50,
        long_weekdays: ["sat", "sun"],
        rest_weekdays: ["mon"],
        mix_easy: 60,
        mix_threshold: 30,
        mix_speed: 10,
      }),
    ]);
  });

  it("PUT rejects empty long days, mix that does not sum to 100, unknown weekday, and non-integer mix", async () => {
    const client = createMemorySupabase({
      profiles: [{ user_id: SESSION, weekly_km: 40 }],
    });
    harness.state.client = client;
    const before = await tableRows(client);

    const emptyLong = await profilePut(context("PUT", { ...VALID_BODY, longWeekdays: [] }));
    expect(emptyLong.status).toBe(400);
    expect(validationErrorCode(await emptyLong.json())).toBe("VALIDATION_ERROR");

    const badSum = await profilePut(context("PUT", { ...VALID_BODY, mixSpeed: 11 }));
    expect(badSum.status).toBe(400);
    expect(validationErrorCode(await badSum.json())).toBe("VALIDATION_ERROR");

    const unknownDay = await profilePut(context("PUT", { ...VALID_BODY, longWeekdays: ["saturday"] }));
    expect(unknownDay.status).toBe(400);
    expect(validationErrorCode(await unknownDay.json())).toBe("VALIDATION_ERROR");

    const fractional = await profilePut(context("PUT", { ...VALID_BODY, mixEasy: 70.5, mixThreshold: 19.5 }));
    expect(fractional.status).toBe(400);
    expect(validationErrorCode(await fractional.json())).toBe("VALIDATION_ERROR");

    expect(await tableRows(client)).toEqual(before);
  });

  it("PUT ignores extra owner fields and persists as the session user", async () => {
    const client = createMemorySupabase({
      profiles: [
        { user_id: VICTIM, weekly_km: 42, long_weekdays: ["fri"], mix_easy: 50, mix_threshold: 40, mix_speed: 10 },
      ],
    });
    harness.state.client = client;

    const response = await profilePut(context("PUT", { ...VALID_BODY, userId: VICTIM, user_id: VICTIM }));
    expect(response.status).toBe(200);

    const stored = await tableRows(client);
    const sessionRow = stored.find((row) => row.user_id === SESSION);
    expect(sessionRow).toEqual(
      expect.objectContaining({
        user_id: SESSION,
        weekly_km: 50,
        long_weekdays: ["sat", "sun"],
      }),
    );
    expect(stored.filter((row) => row.user_id === VICTIM)).toEqual([
      expect.objectContaining({ user_id: VICTIM, weekly_km: 42, long_weekdays: ["fri"] }),
    ]);
  });

  it("GET applies SQL prefs defaults on a sparse weekly_km-only row", async () => {
    harness.state.client = createMemorySupabase({
      profiles: [{ user_id: SESSION, weekly_km: 47.5 }],
    });
    const response = await profileGet(context("GET"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      weeklyKm: 47.5,
      longWeekdays: ["sat"],
      restWeekdays: [],
      mixEasy: 70,
      mixThreshold: 20,
      mixSpeed: 10,
      ...LAST_RACE_UNSET,
      ...COACH_NOTES_UNSET,
    });
  });
});

describe("profile PATCH last race", () => {
  beforeEach(() => {
    harness.state.client = null;
  });

  it("returns 404 when there is no profiles row and does not insert", async () => {
    const client = createMemorySupabase();
    harness.state.client = client;
    const response = await profilePatch(context("PATCH", VALID_LAST_RACE));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: "NOT_FOUND", message: "Not found" },
    });
    expect(await tableRows(client)).toEqual([]);
  });

  it("round-trips last race on GET and ignores extra owner fields", async () => {
    const client = createMemorySupabase({
      profiles: [
        {
          user_id: SESSION,
          weekly_km: 50,
          long_weekdays: ["sat", "sun"],
          rest_weekdays: ["mon"],
          mix_easy: 60,
          mix_threshold: 30,
          mix_speed: 10,
        },
        {
          user_id: VICTIM,
          weekly_km: 42,
          long_weekdays: ["fri"],
          mix_easy: 50,
          mix_threshold: 40,
          mix_speed: 10,
        },
      ],
    });
    harness.state.client = client;

    const response = await profilePatch(context("PATCH", { ...VALID_LAST_RACE, userId: VICTIM, user_id: VICTIM }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ...VALID_VIEW,
      ...VALID_LAST_RACE,
    });

    const getResponse = await profileGet(context("GET"));
    expect(await getResponse.json()).toEqual({
      ...VALID_VIEW,
      ...VALID_LAST_RACE,
    });

    const stored = await tableRows(client);
    expect(stored.find((row) => row.user_id === SESSION)).toEqual(
      expect.objectContaining({
        user_id: SESSION,
        last_race_date: "2026-04-12",
        last_race_km: 10,
        last_race_time_sec: 2490,
      }),
    );
    expect(stored.find((row) => row.user_id === VICTIM)).toEqual(
      expect.objectContaining({ user_id: VICTIM, weekly_km: 42 }),
    );
    expect(stored.find((row) => row.user_id === VICTIM)?.last_race_date).toBeUndefined();
  });

  it("rejects invalid date and non-positive time without writing", async () => {
    const client = createMemorySupabase({
      profiles: [{ user_id: SESSION, weekly_km: 50 }],
    });
    harness.state.client = client;
    const before = await tableRows(client);

    const badDate = await profilePatch(context("PATCH", { ...VALID_LAST_RACE, lastRaceDate: "12 Apr 2026" }));
    expect(badDate.status).toBe(400);
    expect(validationErrorCode(await badDate.json())).toBe("VALIDATION_ERROR");

    const zeroTime = await profilePatch(context("PATCH", { ...VALID_LAST_RACE, lastRaceTimeSec: 0 }));
    expect(zeroTime.status).toBe(400);
    expect(validationErrorCode(await zeroTime.json())).toBe("VALIDATION_ERROR");

    expect(await tableRows(client)).toEqual(before);
  });

  it("PUT of prefs leaves last-race columns intact", async () => {
    const client = createMemorySupabase({
      profiles: [
        {
          user_id: SESSION,
          weekly_km: 40,
          long_weekdays: ["sat"],
          rest_weekdays: [],
          mix_easy: 70,
          mix_threshold: 20,
          mix_speed: 10,
        },
      ],
    });
    harness.state.client = client;

    const patched = await profilePatch(context("PATCH", VALID_LAST_RACE));
    expect(patched.status).toBe(200);

    const putResponse = await profilePut(context("PUT", VALID_BODY));
    expect(putResponse.status).toBe(200);
    expect(await putResponse.json()).toEqual({
      ...VALID_VIEW,
      ...VALID_LAST_RACE,
    });

    const getResponse = await profileGet(context("GET"));
    expect(await getResponse.json()).toEqual({
      ...VALID_VIEW,
      ...VALID_LAST_RACE,
    });
  });
});

describe("profile PUT coach notes", () => {
  beforeEach(() => {
    harness.state.client = null;
  });

  it("round-trips coachNotes on GET and ignores extra owner fields", async () => {
    const client = createMemorySupabase({
      profiles: [{ user_id: VICTIM, weekly_km: 42, coach_notes: "victim-only" }],
    });
    harness.state.client = client;

    const response = await profilePut(
      context("PUT", { ...VALID_BODY, coachNotes: "Keep long easy", userId: VICTIM, user_id: VICTIM }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ...VALID_VIEW,
      coachNotes: "Keep long easy",
    });

    const getResponse = await profileGet(context("GET"));
    expect(await getResponse.json()).toEqual({
      ...VALID_VIEW,
      coachNotes: "Keep long easy",
    });

    const stored = await tableRows(client);
    expect(stored.find((row) => row.user_id === SESSION)).toEqual(
      expect.objectContaining({ user_id: SESSION, coach_notes: "Keep long easy" }),
    );
    expect(stored.find((row) => row.user_id === VICTIM)).toEqual(
      expect.objectContaining({ user_id: VICTIM, weekly_km: 42, coach_notes: "victim-only" }),
    );
  });

  it("stores empty coachNotes as null", async () => {
    const client = createMemorySupabase();
    harness.state.client = client;
    const response = await profilePut(context("PUT", { ...VALID_BODY, coachNotes: "" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(VALID_VIEW);
    const stored = await tableRows(client);
    expect(stored.find((row) => row.user_id === SESSION)?.coach_notes).toBeNull();
  });

  it("clamps coachNotes to 2000 characters", async () => {
    const client = createMemorySupabase();
    harness.state.client = client;
    const response = await profilePut(context("PUT", { ...VALID_BODY, coachNotes: "a".repeat(2001) }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ...VALID_VIEW,
      coachNotes: "a".repeat(2000),
    });
  });

  it("PUT of prefs without coachNotes leaves notes intact", async () => {
    const client = createMemorySupabase();
    harness.state.client = client;
    const withNotes = await profilePut(context("PUT", { ...VALID_BODY, coachNotes: "Keep Fridays easy" }));
    expect(withNotes.status).toBe(200);

    const putResponse = await profilePut(context("PUT", VALID_BODY));
    expect(putResponse.status).toBe(200);
    expect(await putResponse.json()).toEqual({
      ...VALID_VIEW,
      coachNotes: "Keep Fridays easy",
    });
  });
});

describe("profile PUT weeklyKm null keeps the row", () => {
  beforeEach(() => {
    harness.state.client = null;
  });

  const SEEDED = {
    user_id: SESSION,
    weekly_km: 50,
    long_weekdays: ["sat", "sun"],
    rest_weekdays: ["mon"],
    mix_easy: 60,
    mix_threshold: 30,
    mix_speed: 10,
    last_race_date: "2026-04-12",
    last_race_km: 10,
    last_race_time_sec: 2490,
    coach_notes: "Keep long easy",
  };

  const CLEARED_VIEW = {
    ...VALID_BODY,
    weeklyKm: null,
    ...VALID_LAST_RACE,
    coachNotes: "Keep long easy",
  };

  it("PUT weeklyKm null keeps last race, notes, and prefs; GET matches; 0 and -1 stay 400", async () => {
    const client = createMemorySupabase({ profiles: [{ ...SEEDED }] });
    harness.state.client = client;
    const before = await tableRows(client);

    const zero = await profilePut(context("PUT", { ...VALID_BODY, weeklyKm: 0 }));
    expect(zero.status).toBe(400);
    expect(validationErrorCode(await zero.json())).toBe("VALIDATION_ERROR");

    const negative = await profilePut(context("PUT", { ...VALID_BODY, weeklyKm: -1 }));
    expect(negative.status).toBe(400);
    expect(validationErrorCode(await negative.json())).toBe("VALIDATION_ERROR");
    expect(await tableRows(client)).toEqual(before);

    const putResponse = await profilePut(context("PUT", { ...VALID_BODY, weeklyKm: null }));
    expect(putResponse.status).toBe(200);
    expect(await putResponse.json()).toEqual(CLEARED_VIEW);

    const getResponse = await profileGet(context("GET"));
    expect(await getResponse.json()).toEqual(CLEARED_VIEW);

    const stored = await tableRows(client);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toEqual(
      expect.objectContaining({
        user_id: SESSION,
        weekly_km: null,
        long_weekdays: ["sat", "sun"],
        rest_weekdays: ["mon"],
        mix_easy: 60,
        mix_threshold: 30,
        mix_speed: 10,
        last_race_date: "2026-04-12",
        last_race_km: 10,
        last_race_time_sec: 2490,
        coach_notes: "Keep long easy",
      }),
    );
  });

  it("PUT weeklyKm null without coachNotes leaves notes intact", async () => {
    const client = createMemorySupabase({
      profiles: [{ user_id: SESSION, weekly_km: 50, coach_notes: "Keep Fridays easy" }],
    });
    harness.state.client = client;
    const putResponse = await profilePut(context("PUT", { ...VALID_BODY, weeklyKm: null }));
    expect(putResponse.status).toBe(200);
    expect(await putResponse.json()).toEqual({
      ...VALID_BODY,
      weeklyKm: null,
      ...LAST_RACE_UNSET,
      coachNotes: "Keep Fridays easy",
    });
  });

  it("PATCH last race works when weekly_km is null and still 404s with no row", async () => {
    const empty = createMemorySupabase();
    harness.state.client = empty;
    const missing = await profilePatch(context("PATCH", VALID_LAST_RACE));
    expect(missing.status).toBe(404);
    expect(await tableRows(empty)).toEqual([]);

    const client = createMemorySupabase({
      profiles: [
        {
          user_id: SESSION,
          weekly_km: null,
          long_weekdays: ["sat", "sun"],
          rest_weekdays: ["mon"],
          mix_easy: 60,
          mix_threshold: 30,
          mix_speed: 10,
        },
      ],
    });
    harness.state.client = client;
    const response = await profilePatch(context("PATCH", VALID_LAST_RACE));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ...VALID_BODY,
      weeklyKm: null,
      ...VALID_LAST_RACE,
      ...COACH_NOTES_UNSET,
    });
  });
});
