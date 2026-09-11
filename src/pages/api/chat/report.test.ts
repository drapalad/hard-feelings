import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createMemorySupabase } from "@/lib/test/memory-supabase";
import { POST as reportPost } from "./report";

const { harness } = vi.hoisted(() => {
  const state: { client: SupabaseClient | null } = { client: null };
  return {
    harness: {
      state,
      createClient: () => state.client,
    },
  };
});

vi.mock("@/lib/supabase", () => ({
  createClient: harness.createClient,
}));

const USER_ID = "member-session";
const MONDAY = "2026-08-10";

type RouteHandler = typeof reportPost;

function context(body: unknown, userId: string | null = USER_ID): Parameters<RouteHandler>[0] {
  const url = new URL("http://localhost/api/chat/report");
  return {
    locals: { user: userId === null ? null : { id: userId }, isAdmin: false },
    request: new Request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    url,
  } as Parameters<RouteHandler>[0];
}

describe("POST /api/chat/report", () => {
  beforeEach(() => {
    harness.state.client = null;
  });

  it("returns 401 for logged-out requests", async () => {
    const response = await reportPost(context({ weekStart: MONDAY, messageId: "a-1" }, null));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "Sign in required" },
    });
  });

  it("inserts a gap report for the latest assistant message", async () => {
    const client = createMemorySupabase({
      chat_threads: [{ id: "thread-1", user_id: USER_ID, title: "Gap", started_at: "2026-08-10T00:00:00.000Z" }],
      chat_messages: [
        {
          id: "u-1",
          user_id: USER_ID,
          thread_id: "thread-1",
          week_start: MONDAY,
          role: "user",
          content: "Can you adjust Friday?",
          created_at: "2026-08-10T00:00:00.000Z",
        },
        {
          id: "a-1",
          user_id: USER_ID,
          thread_id: "thread-1",
          week_start: MONDAY,
          role: "assistant",
          content: "I suggested a longer Friday.",
          created_at: "2026-08-10T00:01:00.000Z",
        },
      ],
    });
    harness.state.client = client;

    const response = await reportPost(context({ weekStart: MONDAY, messageId: "a-1" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });

    const stored = await client.from("agent_reports").select("*").eq("source_user_id", USER_ID).maybeSingle();
    expect(stored.error).toBeNull();
    expect(stored.data).toEqual(
      expect.objectContaining({
        source_user_id: USER_ID,
        week_start: MONDAY,
        kind: "gap",
        status: "open",
      }),
    );
  });

  it("copies a stamped technical snapshot onto the gap body", async () => {
    const snapshot = JSON.stringify(
      {
        mutations: [{ date: "2026-08-14", distanceKm: 25 }],
        log: null,
        profile: null,
        freeze: null,
        unfreeze: null,
        races: null,
        validation: { hard: [], soft: [] },
        dataRequest: null,
        persist: { proposedCount: 1, appliedCount: 0, weeksWritten: [] },
      },
      null,
      2,
    );
    const client = createMemorySupabase({
      chat_threads: [{ id: "thread-1", user_id: USER_ID, title: "Gap", started_at: "2026-08-10T00:00:00.000Z" }],
      chat_messages: [
        {
          id: "u-1",
          user_id: USER_ID,
          thread_id: "thread-1",
          week_start: MONDAY,
          role: "user",
          content: "Can you adjust Friday?",
          created_at: "2026-08-10T00:00:00.000Z",
        },
        {
          id: "a-1",
          user_id: USER_ID,
          thread_id: "thread-1",
          week_start: MONDAY,
          role: "assistant",
          content: `I suggested a longer Friday.\n\n<!--hf-technical-payload-->\n${snapshot}`,
          created_at: "2026-08-10T00:01:00.000Z",
        },
      ],
    });
    harness.state.client = client;

    const response = await reportPost(context({ weekStart: MONDAY, messageId: "a-1" }));
    expect(response.status).toBe(200);
    const stored = await client.from("agent_reports").select("body, kind").eq("source_user_id", USER_ID).maybeSingle();
    expect(stored.data).toEqual(
      expect.objectContaining({
        kind: "gap",
      }),
    );
    expect(String(stored.data?.body)).toContain("<!--hf-technical-payload-->");
    expect(String(stored.data?.body)).toContain('"appliedCount": 0');
    expect(String(stored.data?.body)).toContain("Assistant: I suggested a longer Friday.");
  });

  it("returns 404 for unknown or non-latest message ids", async () => {
    harness.state.client = createMemorySupabase({
      chat_threads: [{ id: "thread-1", user_id: USER_ID, title: "Gap", started_at: "2026-08-10T00:00:00.000Z" }],
      chat_messages: [
        {
          id: "u-1",
          user_id: USER_ID,
          thread_id: "thread-1",
          week_start: MONDAY,
          role: "user",
          content: "Can you adjust Friday?",
          created_at: "2026-08-10T00:00:00.000Z",
        },
        {
          id: "a-1",
          user_id: USER_ID,
          thread_id: "thread-1",
          week_start: MONDAY,
          role: "assistant",
          content: "First reply.",
          created_at: "2026-08-10T00:01:00.000Z",
        },
        {
          id: "u-2",
          user_id: USER_ID,
          thread_id: "thread-1",
          week_start: MONDAY,
          role: "user",
          content: "What about Sunday?",
          created_at: "2026-08-10T00:02:00.000Z",
        },
        {
          id: "a-2",
          user_id: USER_ID,
          thread_id: "thread-1",
          week_start: MONDAY,
          role: "assistant",
          content: "Latest reply.",
          created_at: "2026-08-10T00:03:00.000Z",
        },
      ],
    });

    const oldResponse = await reportPost(context({ weekStart: MONDAY, messageId: "a-1" }));
    expect(oldResponse.status).toBe(404);

    const missingResponse = await reportPost(context({ weekStart: MONDAY, messageId: "missing" }));
    expect(missingResponse.status).toBe(404);
  });
});
