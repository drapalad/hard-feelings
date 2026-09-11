import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AgentReport,
  AgentReportKind,
  AgentReportStatus,
  BoundCode,
  ChatMessage,
  FlagTurnSnapshot,
  ValidateResult,
} from "@/types";

export const FLAG_TECHNICAL_MARKER = "<!--hf-technical-payload-->";

const BOUND_HINTS: Record<BoundCode, string> = {
  WEEKLY_VOLUME_EXCEEDED:
    "Consider shrinking another day when chat asks for more km so the week stays inside the hard volume ceiling.",
  CONSECUTIVE_LONGS:
    "Generator never places long; consider a long-placement rule or refusing consecutive-long mutations in the proposer.",
  FROZEN_ANCHOR_DROPPED: "Proposer should refuse mutations that drop frozen anchors before they become pending.",
};

export function shouldCaptureHardBoundReport(mutationsLength: number, validation: ValidateResult): boolean {
  return mutationsLength > 0 && validation.hard.length > 0;
}

export function buildHardBoundReport(input: {
  sourceUserId: string;
  weekStart: string;
  validation: ValidateResult;
}): Omit<AgentReport, "id" | "createdAt" | "reviewedAt"> | null {
  if (input.validation.hard.length === 0) {
    return null;
  }
  const boundCodes = uniqueBoundCodes(input.validation.hard.map((item) => item.code));
  const messages = input.validation.hard.map((item) => item.message);
  const hints = boundCodes.map((code) => BOUND_HINTS[code]);
  return {
    sourceUserId: input.sourceUserId,
    weekStart: input.weekStart,
    kind: "algorithm_proposal",
    status: "open",
    title: `Hard bounds blocked a plan change (${boundCodes.join(", ")})`,
    body: [...messages, ...hints].join("\n"),
    boundCodes,
  };
}

export function splitAgentReportBody(body: string): { prose: string; technical: string | null } {
  const markerIndex = body.indexOf(FLAG_TECHNICAL_MARKER);
  if (markerIndex === -1) {
    return { prose: body, technical: null };
  }
  const suffix = body.slice(markerIndex + FLAG_TECHNICAL_MARKER.length).trim();
  try {
    JSON.parse(suffix);
    return { prose: body.slice(0, markerIndex).trimEnd(), technical: suffix };
  } catch {
    return { prose: body, technical: null };
  }
}

export function buildGapReport(input: {
  sourceUserId: string;
  weekStart: string;
  assistant: ChatMessage;
  userMessage?: ChatMessage;
  snapshot?: FlagTurnSnapshot;
}): Omit<AgentReport, "id" | "createdAt" | "reviewedAt"> {
  const titleBase = input.assistant.content.trim().replace(/\s+/g, " ");
  const title = titleBase === "" ? "Member flagged a coach reply" : `Member flagged: ${titleBase.slice(0, 72)}`;
  const bodyParts = ["Member flagged this coach reply for admin review."];
  if (input.userMessage) {
    bodyParts.push(`User: ${input.userMessage.content}`);
  }
  bodyParts.push(`Assistant: ${input.assistant.content}`);
  let body = bodyParts.join("\n\n");
  if (input.snapshot !== undefined) {
    body = `${body}\n\n${FLAG_TECHNICAL_MARKER}\n${JSON.stringify(input.snapshot, null, 2)}`;
  }
  return {
    sourceUserId: input.sourceUserId,
    weekStart: input.weekStart,
    kind: "gap",
    status: "open",
    title,
    body,
    boundCodes: [],
  };
}

function uniqueBoundCodes(codes: BoundCode[]): BoundCode[] {
  const seen = new Set<BoundCode>();
  const unique: BoundCode[] = [];
  for (const code of codes) {
    if (seen.has(code)) {
      continue;
    }
    seen.add(code);
    unique.push(code);
  }
  return unique;
}

const BOUND_CODES: BoundCode[] = ["WEEKLY_VOLUME_EXCEEDED", "CONSECUTIVE_LONGS", "FROZEN_ANCHOR_DROPPED"];
const REPORT_KINDS: AgentReportKind[] = ["gap", "algorithm_proposal"];
const REPORT_STATUSES: AgentReportStatus[] = ["open", "reviewed"];

export type InsertableAgentReport = Omit<AgentReport, "id" | "createdAt" | "reviewedAt">;

export async function insertAgentReport(client: SupabaseClient, report: InsertableAgentReport): Promise<void> {
  const { error } = await client.from("agent_reports").insert({
    source_user_id: report.sourceUserId,
    week_start: report.weekStart,
    kind: report.kind,
    status: report.status,
    title: report.title,
    body: report.body,
    bound_codes: report.boundCodes,
  });
  if (error) {
    throw new Error(error.message);
  }
}

export async function listAgentReports(client: SupabaseClient): Promise<AgentReport[]> {
  const { data, error } = await client
    .from("agent_reports")
    .select("id, source_user_id, week_start, kind, status, title, body, bound_codes, created_at, reviewed_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    throw new Error(error.message);
  }
  if (!Array.isArray(data)) {
    return [];
  }
  return data.flatMap((row) => {
    const report = asAgentReport(row);
    return report === null ? [] : [report];
  });
}

export async function markAgentReportReviewed(
  client: SupabaseClient,
  id: string,
): Promise<{ ok: true } | { ok: false; code: "NOT_FOUND" }> {
  const { data, error } = await client
    .from("agent_reports")
    .update({ status: "reviewed", reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "open")
    .select("id");
  if (error) {
    throw new Error(error.message);
  }
  if (!Array.isArray(data) || data.length === 0) {
    return { ok: false, code: "NOT_FOUND" };
  }
  return { ok: true };
}

export async function deleteAgentReport(
  client: SupabaseClient,
  id: string,
): Promise<{ ok: true } | { ok: false; code: "NOT_FOUND" }> {
  const { data, error } = await client.from("agent_reports").delete().eq("id", id).select("id");
  if (error) {
    throw new Error(error.message);
  }
  if (!Array.isArray(data) || data.length === 0) {
    return { ok: false, code: "NOT_FOUND" };
  }
  return { ok: true };
}

function asAgentReport(data: unknown): AgentReport | null {
  if (typeof data !== "object" || data === null) {
    return null;
  }
  if (
    !("id" in data) ||
    !("source_user_id" in data) ||
    !("week_start" in data) ||
    !("kind" in data) ||
    !("status" in data) ||
    !("title" in data) ||
    !("body" in data) ||
    !("bound_codes" in data) ||
    !("created_at" in data)
  ) {
    return null;
  }
  if (
    typeof data.id !== "string" ||
    typeof data.source_user_id !== "string" ||
    typeof data.week_start !== "string" ||
    typeof data.title !== "string" ||
    typeof data.body !== "string" ||
    typeof data.created_at !== "string"
  ) {
    return null;
  }
  if (typeof data.kind !== "string" || !REPORT_KINDS.includes(data.kind as AgentReportKind)) {
    return null;
  }
  if (typeof data.status !== "string" || !REPORT_STATUSES.includes(data.status as AgentReportStatus)) {
    return null;
  }
  const boundCodes = parseBoundCodes(data.bound_codes);
  if (boundCodes === null) {
    return null;
  }
  let reviewedAt: string | null = null;
  if ("reviewed_at" in data && data.reviewed_at !== null) {
    if (typeof data.reviewed_at !== "string") {
      return null;
    }
    reviewedAt = data.reviewed_at;
  }
  return {
    id: data.id,
    sourceUserId: data.source_user_id,
    weekStart: data.week_start,
    kind: data.kind as AgentReportKind,
    status: data.status as AgentReportStatus,
    title: data.title,
    body: data.body,
    boundCodes,
    createdAt: data.created_at,
    reviewedAt,
  };
}

function parseBoundCodes(value: unknown): BoundCode[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const codes: BoundCode[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !BOUND_CODES.includes(item as BoundCode)) {
      return null;
    }
    codes.push(item as BoundCode);
  }
  return codes;
}
