import { z } from "zod";
import { addUtcDays } from "@/lib/dates";
import { sanitizeProposeResult, type ProposeResult, type RawProposeResult } from "./propose-adaptation";
import type {
  ChatRole,
  LoadedRange,
  PendingRacesPatch,
  ProfileView,
  Race,
  RacePriority,
  TrainingUnit,
  Weekday,
  WorkoutLog,
} from "@/types";

const WORKOUT_TYPES = ["base", "recovery", "tempo", "threshold", "anaerobic", "long"] as const;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const HISTORY_LIMIT = 12;
const FETCH_TIMEOUT_MS = 20_000;
export const MAX_DATA_REQUEST_DAYS = 70;

const WEEKDAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const loadedRangeSchema = z.object({
  from: z.string().regex(ISO_DATE),
  to: z.string().regex(ISO_DATE),
});

const profilePatchSchema = z.object({
  weeklyKm: z.number().nullable().optional(),
  longWeekdays: z.array(z.enum(WEEKDAYS)).nullable().optional(),
  restWeekdays: z.array(z.enum(WEEKDAYS)).nullable().optional(),
  mixEasy: z.number().nullable().optional(),
  mixThreshold: z.number().nullable().optional(),
  mixSpeed: z.number().nullable().optional(),
});

function compactProfilePatch(
  value: z.infer<typeof profilePatchSchema> | null | undefined,
): NonNullable<RawProposeResult["profile"]> | null {
  if (value == null) {
    return null;
  }
  const patch: NonNullable<RawProposeResult["profile"]> = {};
  if (typeof value.weeklyKm === "number") {
    patch.weeklyKm = value.weeklyKm;
  }
  if (value.longWeekdays != null) {
    patch.longWeekdays = value.longWeekdays;
  }
  if (value.restWeekdays != null) {
    patch.restWeekdays = value.restWeekdays;
  }
  if (typeof value.mixEasy === "number") {
    patch.mixEasy = value.mixEasy;
  }
  if (typeof value.mixThreshold === "number") {
    patch.mixThreshold = value.mixThreshold;
  }
  if (typeof value.mixSpeed === "number") {
    patch.mixSpeed = value.mixSpeed;
  }
  return Object.keys(patch).length === 0 ? null : patch;
}

const RACE_PRIORITIES: RacePriority[] = ["A", "B", "C", "D"];

const raceAddSchema = z.object({
  date: z.string().regex(ISO_DATE),
  priority: z.enum(["A", "B", "C", "D"]),
  name: z.string().nullable().optional(),
  goal: z.string().nullable().optional(),
});

const raceRemoveSchema = z.object({
  id: z.string().min(1),
});

const racePatchItemSchema = z.object({
  id: z.string().min(1),
  date: z.string().regex(ISO_DATE).nullable().optional(),
  priority: z.enum(["A", "B", "C", "D"]).nullable().optional(),
  name: z.string().nullable().optional(),
  goal: z.string().nullable().optional(),
});

const racesPatchSchema = z.object({
  add: z.array(raceAddSchema),
  remove: z.array(raceRemoveSchema),
  patch: z.array(racePatchItemSchema),
});

function optionalRaceText(value: string | null | undefined): string | undefined {
  if (value == null || value.trim() === "") {
    return undefined;
  }
  return value.trim();
}

function compactRacesPatch(value: z.infer<typeof racesPatchSchema> | null | undefined): PendingRacesPatch | null {
  if (value == null) {
    return null;
  }
  const add = value.add.flatMap((item) => {
    const name = optionalRaceText(item.name);
    const goal = optionalRaceText(item.goal);
    const row: PendingRacesPatch["add"][number] = { date: item.date, priority: item.priority };
    if (name !== undefined) {
      row.name = name;
    }
    if (goal !== undefined) {
      row.goal = goal;
    }
    return [row];
  });
  const remove = value.remove.filter((item) => item.id !== "").map((item) => ({ id: item.id }));
  const patch = value.patch.flatMap((item) => {
    if (item.id === "") {
      return [];
    }
    const row: PendingRacesPatch["patch"][number] = { id: item.id };
    if (item.date != null) {
      row.date = item.date;
    }
    if (item.priority != null) {
      row.priority = item.priority;
    }
    const name = optionalRaceText(item.name);
    const goal = optionalRaceText(item.goal);
    if (name !== undefined) {
      row.name = name;
    }
    if (goal !== undefined) {
      row.goal = goal;
    }
    return [row];
  });
  if (add.length === 0 && remove.length === 0 && patch.length === 0) {
    return null;
  }
  return { add, remove, patch };
}

export interface CompactCoachRace {
  id: string;
  date: string;
  priority: RacePriority;
  name?: string;
  goal?: string;
}

export function compactCoachRaces(races: Race[], today: string): CompactCoachRace[] {
  return races.flatMap((race) => {
    const upcoming = race.date >= today;
    const aWithGoal = race.priority === "A" && typeof race.goal === "string" && race.goal.trim() !== "";
    if (!upcoming && !aWithGoal) {
      return [];
    }
    const compact: CompactCoachRace = { id: race.id, date: race.date, priority: race.priority };
    if (race.name !== undefined && race.name !== "") {
      compact.name = race.name;
    }
    if (race.goal !== undefined && race.goal !== "") {
      compact.goal = race.goal;
    }
    return [compact];
  });
}

export const parsedProposeSchema = z.object({
  reply: z.string(),
  mutations: z.array(
    z.object({
      date: z.string(),
      type: z.enum(WORKOUT_TYPES).nullable(),
      distanceKm: z.number().nullable(),
      structure: z.string().nullable(),
      delete: z.boolean().optional(),
    }),
  ),
  log: z
    .object({
      date: z.string(),
      distanceKm: z.number().nullable(),
    })
    .nullable(),
  dataRequest: z.union([z.null(), loadedRangeSchema]),
  profile: profilePatchSchema.nullable().optional(),
  freeze: z.array(z.string()).nullable().optional(),
  unfreeze: z.array(z.string()).nullable().optional(),
  races: racesPatchSchema.nullable().optional(),
});

const PROPOSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "mutations", "log", "dataRequest", "profile", "freeze", "unfreeze", "races"],
  properties: {
    reply: { type: "string" },
    mutations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["date", "type", "distanceKm", "structure", "delete"],
        properties: {
          date: { type: "string" },
          type: { type: ["string", "null"], enum: [...WORKOUT_TYPES, null] },
          distanceKm: { type: ["number", "null"] },
          structure: { type: ["string", "null"] },
          delete: { type: "boolean" },
        },
      },
    },
    log: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["date", "distanceKm"],
          properties: {
            date: { type: "string" },
            distanceKm: { type: ["number", "null"] },
          },
        },
      ],
    },
    dataRequest: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["from", "to"],
          properties: {
            from: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
            to: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
          },
        },
      ],
    },
    profile: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["weeklyKm", "longWeekdays", "restWeekdays", "mixEasy", "mixThreshold", "mixSpeed"],
          properties: {
            weeklyKm: { type: ["number", "null"] },
            longWeekdays: { type: ["array", "null"], items: { type: "string", enum: WEEKDAYS } },
            restWeekdays: { type: ["array", "null"], items: { type: "string", enum: WEEKDAYS } },
            mixEasy: { type: ["number", "null"] },
            mixThreshold: { type: ["number", "null"] },
            mixSpeed: { type: ["number", "null"] },
          },
        },
      ],
    },
    freeze: { anyOf: [{ type: "null" }, { type: "array", items: { type: "string" } }] },
    unfreeze: { anyOf: [{ type: "null" }, { type: "array", items: { type: "string" } }] },
    races: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["add", "remove", "patch"],
          properties: {
            add: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["date", "priority", "name", "goal"],
                properties: {
                  date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
                  priority: { type: "string", enum: RACE_PRIORITIES },
                  name: { type: ["string", "null"] },
                  goal: { type: ["string", "null"] },
                },
              },
            },
            remove: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["id"],
                properties: {
                  id: { type: "string" },
                },
              },
            },
            patch: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["id", "date", "priority", "name", "goal"],
                properties: {
                  id: { type: "string" },
                  date: { type: ["string", "null"], pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
                  priority: { type: ["string", "null"], enum: [...RACE_PRIORITIES, null] },
                  name: { type: ["string", "null"] },
                  goal: { type: ["string", "null"] },
                },
              },
            },
          },
        },
      ],
    },
  },
} as const;

export { PROPOSE_JSON_SCHEMA };

export interface LlmProposeExtra {
  range?: LoadedRange;
  units?: TrainingUnit[];
  logs?: WorkoutLog[];
  races?: Race[];
}

export interface LlmProposeRequest {
  message: string;
  weekStart: string;
  units: TrainingUnit[];
  weeklyKm: number;
  history: { role: ChatRole; content: string }[];
  createFrom?: string;
  createTo?: string;
  profile?: ProfileView;
  currentLoad?: { from: string; to: string; plannedKm: number; loggedKm: number };
  isoWeeks?: { monday: string; plannedKm: number; loggedKm: number; dates: string[] }[];
  extra?: LlmProposeExtra;
  adminCoachNotes?: string | null;
  races?: CompactCoachRace[];
}

export type CompleteProposeResult = ProposeResult & { dataRequest: LoadedRange | null };

export interface OpenAiProposeOptions {
  apiKey: string;
  model: string;
  fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>;
}

export async function completeOpenAiPropose(
  request: LlmProposeRequest,
  options: OpenAiProposeOptions,
): Promise<CompleteProposeResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const turns =
    request.history.length > 0
      ? request.history.slice(-HISTORY_LIMIT)
      : [{ role: "user" as const, content: request.message }];

  const response = await fetchImpl(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    body: JSON.stringify({
      model: options.model,
      messages: [{ role: "system", content: systemPrompt(request) }, ...turns],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "propose_adaptation",
          strict: true,
          schema: PROPOSE_JSON_SCHEMA,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(await openAiFailureMessage(response));
  }

  const body: unknown = await response.json();
  const message = choiceMessage(body);
  if (message === null) {
    throw new Error("OpenAI response is missing a completion message");
  }
  if (typeof message.refusal === "string" && message.refusal !== "") {
    throw new Error("OpenAI refused the completion");
  }
  if (typeof message.content !== "string" || message.content === "") {
    throw new Error("OpenAI response is missing message content");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(message.content) as unknown;
  } catch {
    throw new Error("OpenAI response content is not JSON");
  }

  const parsed = parsedProposeSchema.safeParse(parsedJson);
  if (!parsed.success || parsed.data.reply.trim() === "") {
    throw new Error("OpenAI response JSON failed the propose schema");
  }

  const raw: RawProposeResult = {
    reply: parsed.data.reply,
    mutations: parsed.data.mutations,
    log: parsed.data.log,
    profile: compactProfilePatch(parsed.data.profile),
    freeze: parsed.data.freeze ?? null,
    unfreeze: parsed.data.unfreeze ?? null,
    races: compactRacesPatch(parsed.data.races),
  };
  return {
    ...sanitizeProposeResult(
      raw,
      unitsForSanitize(request),
      request.createFrom === undefined || request.createTo === undefined
        ? undefined
        : { createFrom: request.createFrom, createTo: request.createTo },
    ),
    dataRequest: parsed.data.dataRequest,
  };
}

export function parseLoadedRange(value: unknown): LoadedRange | null {
  const parsed = loadedRangeSchema.safeParse(value);
  if (!parsed.success || parsed.data.from > parsed.data.to) {
    return null;
  }
  return parsed.data;
}

export function clampLoadedRange(range: LoadedRange): LoadedRange {
  const clampedTo = addUtcDays(range.from, MAX_DATA_REQUEST_DAYS - 1);
  if (range.to <= clampedTo) {
    return range;
  }
  return { from: range.from, to: clampedTo };
}

async function openAiFailureMessage(response: Response): Promise<string> {
  const fallback = `OpenAI request failed with status ${response.status}`;
  try {
    const body: unknown = await response.json();
    if (typeof body !== "object" || body === null || !("error" in body)) {
      return fallback;
    }
    const error = body.error;
    if (typeof error !== "object" || error === null) {
      return fallback;
    }
    const code = "code" in error && typeof error.code === "string" ? error.code : "";
    const message = "message" in error && typeof error.message === "string" ? error.message : "";
    const detail = [code, message].filter((part) => part !== "").join(" ");
    return detail === "" ? fallback : `${fallback}: ${detail}`;
  } catch {
    return fallback;
  }
}

function choiceMessage(body: unknown): { content?: unknown; refusal?: unknown } | null {
  if (typeof body !== "object" || body === null || !("choices" in body) || !Array.isArray(body.choices)) {
    return null;
  }
  const first: unknown = body.choices[0];
  if (typeof first !== "object" || first === null || !("message" in first)) {
    return null;
  }
  const message = first.message;
  if (typeof message !== "object" || message === null) {
    return null;
  }
  return message;
}

function unitsForSanitize(request: LlmProposeRequest): TrainingUnit[] {
  const extraUnits = request.extra?.units;
  if (extraUnits === undefined || extraUnits.length === 0) {
    return request.units;
  }
  const byDate = new Map<string, TrainingUnit>();
  for (const unit of request.units) {
    byDate.set(unit.date, unit);
  }
  for (const unit of extraUnits) {
    byDate.set(unit.date, unit);
  }
  return [...byDate.values()];
}

function systemPrompt(request: LlmProposeRequest): string {
  const parts = [
    "You are a running coach for HardFeelings. You propose calendar mutations; you do not write the plan that lands.",
    "Do not change frozen units. Never emit a full replacement week.",
    "Add or change a day with type and distanceKm. Remove a day with delete true (type and distanceKm null).",
    "Explain a unit: empty mutations and log null.",
    "Completed workout: set log and empty mutations. log and mutations are mutually exclusive.",
    "You may propose profile patches and freeze/unfreeze date arrays. Do not directly mutate a frozen workout.",
    "Races live on the races table, not on Profile. Never reply that the profile has no race or goal field.",
    "When the member asks to add, remove, or change a race, propose races.add, races.remove, or races.patch.",
    `Allowed types: ${WORKOUT_TYPES.join(", ")}.`,
    "Set dataRequest to null when unused. When you need more calendar context, request an inclusive UTC date range with from/to (max 70 days).",
    `weekStart: ${request.weekStart}. weeklyKm: ${request.weeklyKm} is Mon–Sun ISO-week volume; do not plan a month-grid week that drops the bleed Monday.`,
  ];
  if (request.profile !== undefined) {
    parts.push(`Profile JSON: ${JSON.stringify(request.profile)}`);
    const notes = request.profile.coachNotes?.trim() ?? "";
    if (notes !== "") {
      parts.push(`Member coach notes: ${notes}`);
    }
  }
  const adminNotes = request.adminCoachNotes?.trim() ?? "";
  if (adminNotes !== "") {
    parts.push(`Admin coach notes: ${adminNotes}`);
  }
  if (request.currentLoad !== undefined) {
    parts.push(`Current load summary JSON: ${JSON.stringify(request.currentLoad)}`);
  }
  if (request.isoWeeks !== undefined) {
    parts.push(`ISO weeks JSON: ${JSON.stringify(request.isoWeeks)}`);
  }
  if (request.races !== undefined) {
    parts.push(`Races JSON: ${JSON.stringify(request.races)}`);
  }
  if (request.extra !== undefined) {
    parts.push("Follow-up extra JSON is included. Set dataRequest to null.");
    if (request.extra.range !== undefined) {
      parts.push(`Loaded range JSON: ${JSON.stringify(request.extra.range)}`);
    }
    if (request.extra.units !== undefined) {
      parts.push(`Range units JSON: ${JSON.stringify(request.extra.units)}`);
    }
    if (request.extra.logs !== undefined) {
      parts.push(`Range logs JSON: ${JSON.stringify(request.extra.logs)}`);
    }
    if (request.extra.races !== undefined) {
      parts.push(`Range races JSON: ${JSON.stringify(request.extra.races)}`);
    }
  }
  return parts.join(" ");
}
