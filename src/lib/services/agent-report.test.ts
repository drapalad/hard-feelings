import { describe, expect, it } from "vitest";
import { createMemorySupabase } from "@/lib/test/memory-supabase";
import {
  buildGapReport,
  buildHardBoundReport,
  deleteAgentReport,
  FLAG_TECHNICAL_MARKER,
  insertAgentReport,
  listAgentReports,
  shouldCaptureHardBoundReport,
  splitAgentReportBody,
} from "./agent-report";
import type { BoundViolation, ChatMessage, FlagTurnSnapshot, ValidateResult } from "@/types";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const WEEK_START = "2026-08-10";

function hard(code: BoundViolation["code"], message: string): BoundViolation {
  return { code, severity: "hard", message };
}

function validation(hardItems: BoundViolation[], softItems: BoundViolation[] = []): ValidateResult {
  return { hard: hardItems, soft: softItems };
}

describe("shouldCaptureHardBoundReport", () => {
  it("is false for empty mutations", () => {
    expect(
      shouldCaptureHardBoundReport(
        0,
        validation([hard("CONSECUTIVE_LONGS", "Long workouts fall on consecutive days.")]),
      ),
    ).toBe(false);
  });

  it("is false for hard-empty validation", () => {
    expect(shouldCaptureHardBoundReport(1, validation([]))).toBe(false);
  });

  it("is true only when both mutations and hard violations exist", () => {
    expect(
      shouldCaptureHardBoundReport(
        1,
        validation([hard("CONSECUTIVE_LONGS", "Long workouts fall on consecutive days.")]),
      ),
    ).toBe(true);
  });
});

describe("buildHardBoundReport", () => {
  it("returns null when hard is empty", () => {
    expect(
      buildHardBoundReport({ sourceUserId: USER_ID, weekStart: WEEK_START, validation: validation([]) }),
    ).toBeNull();
  });

  it("returns an algorithm_proposal with hard codes and the consecutive-longs hint", () => {
    const report = buildHardBoundReport({
      sourceUserId: USER_ID,
      weekStart: WEEK_START,
      validation: validation([
        hard("CONSECUTIVE_LONGS", "Long workouts fall on consecutive days (2026-08-15, 2026-08-16)."),
      ]),
    });

    expect(report).not.toBeNull();
    if (report === null) {
      return;
    }
    expect(report.kind).toBe("algorithm_proposal");
    expect(report.status).toBe("open");
    expect(report.boundCodes).toEqual(["CONSECUTIVE_LONGS"]);
    expect(report.body).toContain("Long workouts fall on consecutive days");
    expect(report.body).toContain("Generator never places long");
    expect(report.body).not.toContain(FLAG_TECHNICAL_MARKER);
    expect(report).not.toHaveProperty("content");
    expect(report).not.toHaveProperty("message");
  });
});

const ASSISTANT: ChatMessage = {
  id: "a-1",
  role: "assistant",
  content: "I suggested a longer Friday.",
  createdAt: "2026-08-10T00:01:00.000Z",
  weekStart: WEEK_START,
};

const USER: ChatMessage = {
  id: "u-1",
  role: "user",
  content: "Can you adjust Friday?",
  createdAt: "2026-08-10T00:00:00.000Z",
  weekStart: WEEK_START,
};

const SNAPSHOT: FlagTurnSnapshot = {
  mutations: [{ date: "2026-08-14", distanceKm: 25 }],
  log: null,
  profile: null,
  freeze: null,
  unfreeze: null,
  races: null,
  validation: { hard: [], soft: [] },
  dataRequest: { from: "2026-08-10", to: "2026-08-16" },
  persist: { proposedCount: 1, appliedCount: 0, weeksWritten: [] },
};

describe("buildGapReport", () => {
  it("keeps prose-only body when snapshot is omitted", () => {
    const report = buildGapReport({
      sourceUserId: USER_ID,
      weekStart: WEEK_START,
      assistant: ASSISTANT,
      userMessage: USER,
    });
    expect(report.kind).toBe("gap");
    expect(report.body).toContain("User: Can you adjust Friday?");
    expect(report.body).toContain("Assistant: I suggested a longer Friday.");
    expect(report.body).not.toContain(FLAG_TECHNICAL_MARKER);
    expect(report.title).toContain("I suggested a longer Friday.");
    expect(report.title).not.toContain(FLAG_TECHNICAL_MARKER);
  });

  it("appends pretty JSON after the marker when snapshot is present", () => {
    const report = buildGapReport({
      sourceUserId: USER_ID,
      weekStart: WEEK_START,
      assistant: ASSISTANT,
      userMessage: USER,
      snapshot: SNAPSHOT,
    });
    expect(report.body).toContain("User: Can you adjust Friday?");
    expect(report.body).toContain("Assistant: I suggested a longer Friday.");
    const split = splitAgentReportBody(report.body);
    expect(split.technical).not.toBeNull();
    const parsed = JSON.parse(split.technical ?? "") as FlagTurnSnapshot;
    expect(parsed.mutations).toEqual([{ date: "2026-08-14", distanceKm: 25 }]);
    expect(parsed.log).toBeNull();
    expect(parsed.profile).toBeNull();
    expect(parsed.freeze).toBeNull();
    expect(parsed.unfreeze).toBeNull();
    expect(parsed.races).toBeNull();
    expect(parsed.validation).toEqual({ hard: [], soft: [] });
    expect(parsed.dataRequest).toEqual({ from: "2026-08-10", to: "2026-08-16" });
    expect(parsed.persist.appliedCount).toBe(0);
    expect(report.title).not.toContain(FLAG_TECHNICAL_MARKER);
    expect(report.title).not.toContain("appliedCount");
  });
});

describe("splitAgentReportBody", () => {
  it("returns technical null for a hard-bound-style body without a marker", () => {
    const report = buildHardBoundReport({
      sourceUserId: USER_ID,
      weekStart: WEEK_START,
      validation: validation([hard("CONSECUTIVE_LONGS", "Long workouts fall on consecutive days.")]),
    });
    expect(report).not.toBeNull();
    if (report === null) {
      return;
    }
    expect(splitAgentReportBody(report.body)).toEqual({ prose: report.body, technical: null });
  });

  it("treats a marker with invalid JSON as unmarked prose", () => {
    const body = `hello\n\n${FLAG_TECHNICAL_MARKER}\nnot-json`;
    expect(splitAgentReportBody(body)).toEqual({ prose: body, technical: null });
  });
});

describe("deleteAgentReport", () => {
  it("removes the matching row and returns NOT_FOUND for a missing id", async () => {
    const client = createMemorySupabase();
    await insertAgentReport(client, {
      sourceUserId: USER_ID,
      weekStart: WEEK_START,
      kind: "gap",
      status: "open",
      title: "Keep",
      body: "Keep body",
      boundCodes: [],
    });
    await insertAgentReport(client, {
      sourceUserId: USER_ID,
      weekStart: WEEK_START,
      kind: "algorithm_proposal",
      status: "reviewed",
      title: "Drop",
      body: "Drop body",
      boundCodes: [],
    });
    const listed = await listAgentReports(client);
    const drop = listed.find((report) => report.title === "Drop");
    const keep = listed.find((report) => report.title === "Keep");
    expect(drop).toBeDefined();
    expect(keep).toBeDefined();
    if (drop === undefined || keep === undefined) {
      return;
    }

    expect(await deleteAgentReport(client, drop.id)).toEqual({ ok: true });
    const remaining = await listAgentReports(client);
    expect(remaining.map((report) => report.id)).toEqual([keep.id]);

    expect(await deleteAgentReport(client, drop.id)).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(await deleteAgentReport(client, "missing-report")).toEqual({ ok: false, code: "NOT_FOUND" });
  });
});
