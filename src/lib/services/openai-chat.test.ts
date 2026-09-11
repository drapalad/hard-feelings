import { describe, expect, it, vi } from "vitest";
import {
  clampLoadedRange,
  compactCoachRaces,
  completeOpenAiPropose,
  parseLoadedRange,
  PROPOSE_JSON_SCHEMA,
} from "./openai-chat";
import type { ProfileView, Race, TrainingUnit, Weekday } from "@/types";

const week: TrainingUnit[] = [
  { date: "2026-08-10", type: "base", distanceKm: 7, structure: "6 x 1 km", frozen: false },
  { date: "2026-08-11", type: "tempo", distanceKm: 10, frozen: false },
  { date: "2026-08-12", type: "recovery", distanceKm: 7, frozen: false },
];

const request = {
  message: "what is Tuesday for",
  weekStart: "2026-08-10",
  units: week,
  weeklyKm: 50,
  history: [{ role: "user" as const, content: "what is Tuesday for" }],
  createFrom: "2026-08-10",
  createTo: "2026-08-23",
  profile: {
    weeklyKm: 50,
    longWeekdays: ["sat"] as Weekday[],
    restWeekdays: [] as Weekday[],
    mixEasy: 70,
    mixThreshold: 20,
    mixSpeed: 10,
    lastRaceDate: null,
    lastRaceKm: null,
    lastRaceTimeSec: null,
    coachNotes: null,
  } satisfies ProfileView,
  currentLoad: {
    from: "2026-08-04",
    to: "2026-08-10",
    plannedKm: 32,
    loggedKm: 21,
  },
  isoWeeks: [
    {
      monday: "2026-08-10",
      plannedKm: 24,
      loggedKm: 21,
      dates: ["2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13", "2026-08-14", "2026-08-15", "2026-08-16"],
    },
  ],
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function completion(content: string | null, refusal?: string): unknown {
  return {
    choices: [
      {
        message: {
          content,
          ...(refusal === undefined ? {} : { refusal }),
        },
      },
    ],
  };
}

function okBody(payload: unknown): Promise<Response> {
  return Promise.resolve(jsonResponse(200, completion(JSON.stringify(payload))));
}

function proposeJson(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    reply: "Ease Monday.",
    mutations: [{ date: "2026-08-10", type: "recovery", distanceKm: 4, structure: null }],
    log: null,
    dataRequest: null,
    ...overrides,
  };
}

describe("compactCoachRaces", () => {
  const today = "2026-09-04";
  const races: Race[] = [
    { id: "upcoming-b", date: "2026-10-01", priority: "B", name: "Tune-up" },
    { id: "past-a-goal", date: "2026-08-01", priority: "A", goal: "sub-3" },
    { id: "past-b", date: "2026-08-15", priority: "B", name: "Old 10k" },
    { id: "past-a-no-goal", date: "2026-07-01", priority: "A" },
  ];

  it("keeps upcoming races and past A-priority with a goal", () => {
    expect(compactCoachRaces(races, today)).toEqual([
      { id: "upcoming-b", date: "2026-10-01", priority: "B", name: "Tune-up" },
      { id: "past-a-goal", date: "2026-08-01", priority: "A", goal: "sub-3" },
    ]);
  });
});

describe("range helpers", () => {
  it("parses valid ranges, rejects inverted ranges, and clamps long spans", () => {
    expect(parseLoadedRange({ from: "2026-09-03", to: "2026-11-12" })).toEqual({
      from: "2026-09-03",
      to: "2026-11-12",
    });
    expect(parseLoadedRange({ from: "2026-11-12", to: "2026-09-03" })).toBeNull();
    expect(clampLoadedRange({ from: "2026-09-03", to: "2026-12-31" })).toEqual({
      from: "2026-09-03",
      to: "2026-11-11",
    });
  });
});

describe("completeOpenAiPropose", () => {
  it("returns sanitized reply, mutations, and optional log from a 2xx schema body", async () => {
    const fetchImpl = vi.fn((url: string, _init?: RequestInit) => {
      expect(url).toBe("https://api.openai.com/v1/chat/completions");
      void _init;
      return okBody(proposeJson());
    });

    const result = await completeOpenAiPropose(request, {
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      fetchImpl,
    });

    expect(result.log).toBeUndefined();
    expect(result.mutations).toEqual([{ date: "2026-08-10", type: "recovery", distanceKm: 4 }]);
    expect(result.reply).toBe("Ease Monday.");
    expect(result.dataRequest).toBeNull();
    expect(fetchImpl).toHaveBeenCalledOnce();
    const firstBody = fetchImpl.mock.calls[0]?.[1]?.body;
    const body = JSON.parse(typeof firstBody === "string" ? firstBody : "{}") as {
      messages: { role: string; content: string }[];
    };
    const prompt = body.messages[0]?.content ?? "";
    expect(prompt).toContain("Never emit a full replacement week.");
    expect(prompt).toContain("Remove a day with delete true");
    expect(prompt).not.toContain("You may create new units only");
    expect(prompt).not.toContain("do not refuse by citing the create window");
    expect(prompt).toContain("Profile JSON:");
    expect(prompt).toContain("Current load summary JSON:");
    expect(prompt).toContain("weeklyKm: 50 is Mon–Sun ISO-week volume");
    expect(prompt).toContain("do not plan a month-grid week that drops the bleed Monday");
    expect(prompt).toContain("ISO weeks JSON:");
    expect(prompt).toContain('"monday":"2026-08-10"');
    expect(prompt).toContain("Races live on the races table, not on Profile");
    expect(prompt).toContain("Never reply that the profile has no race or goal field");
    expect(prompt).not.toContain("Member coach notes:");
    expect(prompt).not.toContain("Admin coach notes:");
    expect(prompt).not.toContain("Week JSON:");
    expect(prompt).not.toContain("logs_42d");
    expect(prompt).not.toContain("prior_plan_14d");

    const created = await completeOpenAiPropose(request, {
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      fetchImpl: () =>
        okBody(
          proposeJson({
            reply: "Added a day.",
            mutations: [{ date: "2026-08-20", type: "base", distanceKm: 8, structure: null }],
          }),
        ),
    });
    expect(created.mutations).toEqual([{ date: "2026-08-20", type: "base", distanceKm: 8 }]);

    const withLog = await completeOpenAiPropose(request, {
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      fetchImpl: () =>
        okBody(
          proposeJson({
            reply: "Logged Tuesday.",
            mutations: [],
            log: { date: "2026-08-11", distanceKm: null },
          }),
        ),
    });
    expect(withLog.log).toEqual({ date: "2026-08-11" });
    expect(withLog.mutations).toEqual([]);

    const both = await completeOpenAiPropose(request, {
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      fetchImpl: () =>
        okBody(
          proposeJson({
            reply: "Logged Tuesday and changed Monday.",
            mutations: [{ date: "2026-08-10", type: "recovery", distanceKm: 4, structure: null }],
            log: { date: "2026-08-11", distanceKm: null },
          }),
        ),
    });
    expect(both.log).toEqual({ date: "2026-08-11" });
    expect(both.mutations).toEqual([]);
  });

  it("returns a loaded range from the JSON response", async () => {
    const result = await completeOpenAiPropose(request, {
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      fetchImpl: () =>
        okBody(
          proposeJson({
            dataRequest: { from: "2026-09-03", to: "2026-11-12" },
          }),
        ),
    });
    expect(result.dataRequest).toEqual({ from: "2026-09-03", to: "2026-11-12" });
  });

  it("returns optional profile and freeze fields from the JSON response", async () => {
    const result = await completeOpenAiPropose(request, {
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      fetchImpl: () =>
        okBody(
          proposeJson({
            profile: { restWeekdays: ["tue"], mixEasy: 60, mixThreshold: 30, mixSpeed: 10 },
            freeze: ["2026-09-03"],
            unfreeze: ["2026-09-04"],
          }),
        ),
    });
    expect(result.profile).toEqual({ restWeekdays: ["tue"], mixEasy: 60, mixThreshold: 30, mixSpeed: 10 });
    expect(result.freeze).toEqual(["2026-09-03"]);
    expect(result.unfreeze).toEqual(["2026-09-04"]);
  });

  it("injects Member coach notes into the system prompt when notes are non-empty", async () => {
    const fetchImpl = vi.fn((_url: string, _init?: RequestInit) => {
      void _url;
      void _init;
      return okBody(proposeJson());
    });
    await completeOpenAiPropose(
      {
        ...request,
        profile: { ...request.profile, coachNotes: "Keep Fridays easy" },
      },
      { apiKey: "sk-test", model: "gpt-4o-mini", fetchImpl },
    );
    const firstBody = fetchImpl.mock.calls[0]?.[1]?.body;
    const body = JSON.parse(typeof firstBody === "string" ? firstBody : "{}") as {
      messages: { role: string; content: string }[];
    };
    expect(body.messages[0]?.content ?? "").toContain("Member coach notes: Keep Fridays easy");
  });

  it("injects Admin coach notes into the system prompt when notes are non-empty", async () => {
    const fetchImpl = vi.fn((_url: string, _init?: RequestInit) => {
      void _url;
      void _init;
      return okBody(proposeJson());
    });
    await completeOpenAiPropose(
      { ...request, adminCoachNotes: "Keep Sundays long" },
      { apiKey: "sk-test", model: "gpt-4o-mini", fetchImpl },
    );
    const firstBody = fetchImpl.mock.calls[0]?.[1]?.body;
    const body = JSON.parse(typeof firstBody === "string" ? firstBody : "{}") as {
      messages: { role: string; content: string }[];
    };
    expect(body.messages[0]?.content ?? "").toContain("Admin coach notes: Keep Sundays long");
  });

  it("injects both Member and Admin coach notes when both are set", async () => {
    const fetchImpl = vi.fn((_url: string, _init?: RequestInit) => {
      void _url;
      void _init;
      return okBody(proposeJson());
    });
    await completeOpenAiPropose(
      {
        ...request,
        adminCoachNotes: "Keep Sundays long",
        profile: { ...request.profile, coachNotes: "Keep Fridays easy" },
      },
      { apiKey: "sk-test", model: "gpt-4o-mini", fetchImpl },
    );
    const firstBody = fetchImpl.mock.calls[0]?.[1]?.body;
    const body = JSON.parse(typeof firstBody === "string" ? firstBody : "{}") as {
      messages: { role: string; content: string }[];
    };
    const prompt = body.messages[0]?.content ?? "";
    expect(prompt).toContain("Member coach notes: Keep Fridays easy");
    expect(prompt).toContain("Admin coach notes: Keep Sundays long");
  });

  it("injects compact Races JSON and parses races.add", async () => {
    const fetchImpl = vi.fn((_url: string, _init?: RequestInit) => {
      void _url;
      void _init;
      return okBody(
        proposeJson({
          reply: "I can add Spring HM.",
          mutations: [],
          races: {
            add: [{ date: "2027-04-12", priority: "A", name: "Spring HM", goal: null }],
            remove: [],
            patch: [],
          },
        }),
      );
    });
    const result = await completeOpenAiPropose(
      {
        ...request,
        races: [{ id: "race-a", date: "2026-10-04", priority: "A", name: "Berlin" }],
      },
      { apiKey: "sk-test", model: "gpt-4o-mini", fetchImpl },
    );
    const firstBody = fetchImpl.mock.calls[0]?.[1]?.body;
    const body = JSON.parse(typeof firstBody === "string" ? firstBody : "{}") as {
      messages: { role: string; content: string }[];
    };
    const prompt = body.messages[0]?.content ?? "";
    expect(prompt).toContain("Races JSON:");
    expect(prompt).toContain('"id":"race-a"');
    expect(result.races).toEqual({
      add: [{ date: "2027-04-12", priority: "A", name: "Spring HM" }],
      remove: [],
      patch: [],
    });
    expect(result.mutations).toEqual([]);
  });

  it("injects Races JSON when the compact list is empty", async () => {
    const fetchImpl = vi.fn((_url: string, _init?: RequestInit) => {
      void _url;
      void _init;
      return okBody(proposeJson());
    });
    await completeOpenAiPropose({ ...request, races: [] }, { apiKey: "sk-test", model: "gpt-4o-mini", fetchImpl });
    const firstBody = fetchImpl.mock.calls[0]?.[1]?.body;
    const body = JSON.parse(typeof firstBody === "string" ? firstBody : "{}") as {
      messages: { role: string; content: string }[];
    };
    expect(body.messages[0]?.content ?? "").toContain("Races JSON: []");
  });

  it("requires races add/remove/patch in the strict JSON schema", () => {
    expect(PROPOSE_JSON_SCHEMA.required).toContain("races");
    const racesObject = PROPOSE_JSON_SCHEMA.properties.races.anyOf[1];
    expect(racesObject.required).toEqual(["add", "remove", "patch"]);
  });

  it("requires delete on mutation items and sanitizes delete true", async () => {
    const mutationObject = PROPOSE_JSON_SCHEMA.properties.mutations.items;
    expect(mutationObject.required).toEqual(["date", "type", "distanceKm", "structure", "delete"]);
    expect(mutationObject.properties.delete).toEqual({ type: "boolean" });

    const result = await completeOpenAiPropose(request, {
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      fetchImpl: () =>
        okBody(
          proposeJson({
            reply: "Removed Monday.",
            mutations: [{ date: "2026-08-10", type: null, distanceKm: null, structure: null, delete: true }],
          }),
        ),
    });
    expect(result.mutations).toEqual([{ date: "2026-08-10", delete: true }]);
  });

  it("requires every profile patch key in the strict JSON schema", () => {
    const profileObject = PROPOSE_JSON_SCHEMA.properties.profile.anyOf[1];
    const keys = ["weeklyKm", "longWeekdays", "restWeekdays", "mixEasy", "mixThreshold", "mixSpeed"];
    expect(profileObject.required).toEqual(keys);
    expect(Object.keys(profileObject.properties)).toEqual(keys);
  });

  it("drops null profile patch fields from a strict-schema payload", async () => {
    const result = await completeOpenAiPropose(request, {
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      fetchImpl: () =>
        okBody(
          proposeJson({
            profile: {
              weeklyKm: null,
              longWeekdays: null,
              restWeekdays: ["tue"],
              mixEasy: null,
              mixThreshold: null,
              mixSpeed: null,
            },
          }),
        ),
    });
    expect(result.profile).toEqual({ restWeekdays: ["tue"] });
  });

  it("puts follow-up extra JSON into the system prompt", async () => {
    const fetchImpl = vi.fn((_url: string, _init?: RequestInit) => {
      void _url;
      void _init;
      return okBody(proposeJson());
    });
    await completeOpenAiPropose(
      {
        ...request,
        extra: {
          range: { from: "2026-09-03", to: "2026-11-12" },
          units: [{ date: "2026-09-03", type: "long", distanceKm: 18, frozen: false }],
          logs: [{ date: "2026-09-03", type: "long", distanceKm: 18 }],
        },
      },
      { apiKey: "sk-test", model: "gpt-4o-mini", fetchImpl },
    );
    const extraBody = fetchImpl.mock.calls[0]?.[1]?.body;
    const body = JSON.parse(typeof extraBody === "string" ? extraBody : "{}") as {
      messages: { role: string; content: string }[];
    };
    const prompt = body.messages[0]?.content ?? "";
    expect(prompt).toContain("Follow-up extra JSON is included");
    expect(prompt).not.toContain("Do not create new units outside the create window");
    expect(prompt).toContain("Loaded range JSON:");
    expect(prompt).toContain("Range units JSON:");
    expect(prompt).toContain("Range logs JSON:");
  });

  it("keeps delete of extra-range existing units outside the create window", async () => {
    const result = await completeOpenAiPropose(
      {
        ...request,
        extra: {
          range: { from: "2026-09-28", to: "2026-09-29" },
          units: [{ date: "2026-09-28", type: "base", distanceKm: 8, frozen: false }],
        },
      },
      {
        apiKey: "sk-test",
        model: "gpt-4o-mini",
        fetchImpl: () =>
          okBody(
            proposeJson({
              reply: "Removed 28 Sep.",
              mutations: [{ date: "2026-09-28", type: null, distanceKm: null, structure: null, delete: true }],
            }),
          ),
      },
    );
    expect(result.mutations).toEqual([{ date: "2026-09-28", delete: true }]);

    const dropped = await completeOpenAiPropose(request, {
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      fetchImpl: () =>
        okBody(
          proposeJson({
            reply: "Removed 28 Sep.",
            mutations: [{ date: "2026-09-28", type: null, distanceKm: null, structure: null, delete: true }],
          }),
        ),
    });
    expect(dropped.mutations).toEqual([]);

    const created = await completeOpenAiPropose(request, {
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      fetchImpl: () =>
        okBody(
          proposeJson({
            reply: "Added 28 Sep.",
            mutations: [{ date: "2026-09-28", type: "base", distanceKm: 8, structure: null }],
          }),
        ),
    });
    expect(created.mutations).toEqual([{ date: "2026-09-28", type: "base", distanceKm: 8 }]);
  });

  it("throws on 401, abort, refusal, and unparseable content", async () => {
    await expect(
      completeOpenAiPropose(request, {
        apiKey: "sk-test",
        model: "gpt-4o-mini",
        fetchImpl: () => Promise.resolve(jsonResponse(401, { error: { message: "unauthorized" } })),
      }),
    ).rejects.toThrow(/401/);

    await expect(
      completeOpenAiPropose(request, {
        apiKey: "sk-test",
        model: "gpt-4o-mini",
        fetchImpl: () => Promise.reject(new DOMException("The operation was aborted.", "AbortError")),
      }),
    ).rejects.toMatchObject({ name: "AbortError" });

    await expect(
      completeOpenAiPropose(request, {
        apiKey: "sk-test",
        model: "gpt-4o-mini",
        fetchImpl: () => Promise.resolve(jsonResponse(200, completion(null, "I can't help with that."))),
      }),
    ).rejects.toThrow(/refused/i);

    await expect(
      completeOpenAiPropose(request, {
        apiKey: "sk-test",
        model: "gpt-4o-mini",
        fetchImpl: () => Promise.resolve(jsonResponse(200, completion("not-json"))),
      }),
    ).rejects.toThrow(/not JSON/i);

    await expect(
      completeOpenAiPropose(request, {
        apiKey: "sk-test",
        model: "gpt-4o-mini",
        fetchImpl: () =>
          okBody({
            reply: "   ",
            mutations: [],
            log: null,
            dataRequest: null,
          }),
      }),
    ).rejects.toThrow(/propose schema/i);
  });
});
