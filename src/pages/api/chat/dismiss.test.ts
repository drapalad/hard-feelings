import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createMemorySupabase } from "@/lib/test/memory-supabase";
import { POST as dismissPost } from "./dismiss";

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

type RouteHandler = typeof dismissPost;

function context(body: unknown, userId: string | null = USER_ID): Parameters<RouteHandler>[0] {
  const url = new URL("http://localhost/api/chat/dismiss");
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

describe("POST /api/chat/dismiss", () => {
  beforeEach(() => {
    harness.state.client = null;
  });

  it("returns 401 for logged-out requests", async () => {
    const response = await dismissPost(context({ weekStart: MONDAY }, null));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "Sign in required" },
    });
  });

  it("dismisses a pending profile/freeze row", async () => {
    const client = createMemorySupabase({
      chat_profile_freeze_pending: [
        {
          id: "pending-profile-freeze",
          user_id: USER_ID,
          week_start: MONDAY,
          profile_patch: { restWeekdays: ["tue"] },
          freeze_dates: ["2026-08-10"],
          unfreeze_dates: [],
          status: "pending",
        },
      ],
    });
    harness.state.client = client;

    const response = await dismissPost(context({ weekStart: MONDAY }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });

    const stored = await client
      .from("chat_profile_freeze_pending")
      .select("*")
      .eq("id", "pending-profile-freeze")
      .maybeSingle();
    expect(stored.data).toEqual(expect.objectContaining({ status: "dismissed" }));
  });
});
