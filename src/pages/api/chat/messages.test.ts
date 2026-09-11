import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createMemorySupabase } from "@/lib/test/memory-supabase";
import { POST as messagesPost } from "./messages";

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

const USER_ID = "member-session";
const MONDAY = "2026-08-10";
const LATEST = "11111111-1111-4111-8111-111111111111";
const OLDER = "22222222-2222-4222-8222-222222222222";
const FOREIGN = "33333333-3333-4333-8333-333333333333";
const DATES = ["2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13", "2026-08-14", "2026-08-15", "2026-08-16"];

type RouteHandler = typeof messagesPost;

function context(body: unknown, userId: string | null = USER_ID): Parameters<RouteHandler>[0] {
  const url = new URL("http://localhost/api/chat/messages");
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

function seedClient() {
  return createMemorySupabase({
    profiles: [{ user_id: USER_ID, weekly_km: 50 }],
    training_units: DATES.map((date) => ({
      user_id: USER_ID,
      date,
      type: "base",
      distance_km: 5,
      structure: null,
      frozen: false,
    })),
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
    ],
  });
}

describe("POST /api/chat/messages threadId", () => {
  beforeEach(() => {
    harness.state.client = null;
  });

  it("defaults to the latest thread when threadId is omitted", async () => {
    const client = seedClient();
    harness.state.client = client;
    const response = await messagesPost(context({ weekStart: MONDAY, content: "hello latest" }));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { threadId: string };
    expect(body.threadId).toBe(LATEST);
    const stored = await client.from("chat_messages").select("*").eq("thread_id", LATEST);
    expect(stored.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ content: "hello latest", thread_id: LATEST })]),
    );
  });

  it("stores on an explicit owned threadId", async () => {
    const client = seedClient();
    harness.state.client = client;
    const response = await messagesPost(context({ weekStart: MONDAY, content: "hello older", threadId: OLDER }));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { threadId: string };
    expect(body.threadId).toBe(OLDER);
    const stored = await client.from("chat_messages").select("*").eq("thread_id", OLDER);
    expect(stored.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ content: "hello older", thread_id: OLDER })]),
    );
  });

  it("returns 404 for a foreign threadId", async () => {
    harness.state.client = seedClient();
    const response = await messagesPost(context({ weekStart: MONDAY, content: "nope", threadId: FOREIGN }));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: "NOT_FOUND", message: "Thread not found." },
    });
  });
});
