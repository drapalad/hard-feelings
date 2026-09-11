import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createMemorySupabase } from "@/lib/test/memory-supabase";
import { GET as threadsGet, POST as threadsPost } from "./threads";
import { GET as chatGet } from "../chat";

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
const OTHER = "member-other";
const MONDAY = "2026-08-10";
const LATEST = "11111111-1111-4111-8111-111111111111";
const OLDER = "22222222-2222-4222-8222-222222222222";
const FOREIGN = "33333333-3333-4333-8333-333333333333";

type RouteHandler = typeof threadsGet;

function context(
  method: string,
  path: string,
  userId: string | null = USER_ID,
  body?: unknown,
): Parameters<RouteHandler>[0] {
  const url = new URL(`http://localhost${path}`);
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

function seedThreads() {
  return createMemorySupabase({
    chat_threads: [
      {
        id: OLDER,
        user_id: USER_ID,
        title: "Older",
        started_at: "2026-08-10T00:00:00.000Z",
      },
      {
        id: LATEST,
        user_id: USER_ID,
        title: "Latest",
        started_at: "2026-08-11T00:00:00.000Z",
      },
      {
        id: FOREIGN,
        user_id: OTHER,
        title: "Secret",
        started_at: "2026-08-12T00:00:00.000Z",
      },
    ],
    chat_messages: [
      {
        id: "older-u",
        user_id: USER_ID,
        thread_id: OLDER,
        week_start: MONDAY,
        role: "user",
        content: "older thread",
        created_at: "2026-08-10T00:00:00.000Z",
      },
      {
        id: "latest-u",
        user_id: USER_ID,
        thread_id: LATEST,
        week_start: "2026-08-17",
        role: "user",
        content: "latest thread",
        created_at: "2026-08-11T00:00:00.000Z",
      },
    ],
  });
}

describe("GET/POST /api/chat/threads", () => {
  beforeEach(() => {
    harness.state.client = null;
  });

  it("returns 401 JSON for logged-out GET and POST", async () => {
    const getResponse = await threadsGet(context("GET", "/api/chat/threads", null));
    expect(getResponse.status).toBe(401);
    expect(await getResponse.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "Sign in required" },
    });
    const postResponse = await threadsPost(context("POST", "/api/chat/threads", null, {}));
    expect(postResponse.status).toBe(401);
    expect(await postResponse.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "Sign in required" },
    });
  });

  it("lists the session user's threads newest-first and ignores planId", async () => {
    harness.state.client = seedThreads();
    const response = await threadsGet(context("GET", "/api/chat/threads?planId=not-a-plan"));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { threads: { id: string; title: string | null }[] };
    expect(body.threads.map((thread) => thread.id)).toEqual([LATEST, OLDER]);
    expect(body.threads.some((thread) => thread.id === FOREIGN)).toBe(false);
  });

  it("creates an empty thread and returns it", async () => {
    harness.state.client = createMemorySupabase();
    const response = await threadsPost(context("POST", "/api/chat/threads", USER_ID, {}));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { id: string; title: string | null; startedAt: string };
    expect(body.id).toEqual(expect.any(String));
    expect(body.title).toBeNull();
    expect(body.startedAt).toEqual(expect.any(String));
    const stored = await harness.state.client.from("chat_threads").select("*").eq("id", body.id).maybeSingle();
    expect(stored.data).toEqual(expect.objectContaining({ user_id: USER_ID, title: null }));
  });
});

describe("GET /api/chat thread selection", () => {
  beforeEach(() => {
    harness.state.client = null;
  });

  it("loads messages for threadId or the latest thread", async () => {
    harness.state.client = seedThreads();
    const latest = await chatGet(context("GET", `/api/chat?weekStart=${MONDAY}`));
    expect(latest.status).toBe(200);
    const latestBody = (await latest.json()) as {
      threadId: string;
      messages: { content: string }[];
    };
    expect(latestBody.threadId).toBe(LATEST);
    expect(latestBody.messages.map((message) => message.content)).toEqual(["latest thread"]);
    expect(latestBody).not.toHaveProperty("proposition");

    const older = await chatGet(context("GET", `/api/chat?weekStart=${MONDAY}&threadId=${OLDER}`));
    expect(older.status).toBe(200);
    const olderBody = (await older.json()) as {
      threadId: string;
      messages: { content: string }[];
    };
    expect(olderBody.threadId).toBe(OLDER);
    expect(olderBody.messages.map((message) => message.content)).toEqual(["older thread"]);
    expect(olderBody).not.toHaveProperty("proposition");
  });

  it("returns 404 for a foreign threadId", async () => {
    harness.state.client = seedThreads();
    const response = await chatGet(context("GET", `/api/chat?weekStart=${MONDAY}&threadId=${FOREIGN}`));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: "NOT_FOUND", message: "Thread not found." },
    });
  });
});
