import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIRoute } from "astro";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import { createMemorySupabase } from "@/lib/test/memory-supabase";
import { DELETE, PATCH } from "./[id]";

vi.mock("astro:env/server", () => ({
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_KEY: "anon-key",
  OPENAI_API_KEY: "",
  OPENAI_MODEL: "",
}));

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(),
}));

const ADMIN_ID = "admin-user";
const REPORT_ID = "report-1";
const OTHER_ID = "report-2";

let client: SupabaseClient;

function reportRow(id: string, title: string) {
  return {
    id,
    source_user_id: "member-a",
    week_start: "2026-08-10",
    kind: "gap",
    status: "open",
    title,
    body: "Member flagged this coach reply for admin review.",
    bound_codes: [],
    created_at: "2026-08-10T00:01:00.000Z",
    reviewed_at: null,
  };
}

function context(
  method: "PATCH" | "DELETE",
  options: { isAdmin: boolean; userId?: string | null; id?: string; body?: unknown },
): Parameters<APIRoute>[0] {
  const id = options.id ?? REPORT_ID;
  const url = new URL(`http://localhost/api/admin/reports/${id}`);
  const init: RequestInit = { method };
  if (options.body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(options.body);
  }
  const userId = options.userId === undefined ? ADMIN_ID : options.userId;
  return {
    locals: { user: userId === null ? null : { id: userId }, isAdmin: options.isAdmin },
    params: { id },
    request: new Request(url, init),
    url,
    cookies: {
      get: () => undefined,
      set: () => undefined,
      has: () => false,
      delete: () => undefined,
    },
  } as unknown as Parameters<APIRoute>[0];
}

describe("PATCH/DELETE /api/admin/reports/[id]", () => {
  beforeEach(() => {
    client = createMemorySupabase({
      agent_reports: [reportRow(REPORT_ID, "Keep"), reportRow(OTHER_ID, "Leave")],
    });
    vi.mocked(createClient).mockReset();
    vi.mocked(createClient).mockReturnValue(client);
  });

  it("returns 401 UNAUTHORIZED for logged-out DELETE and PATCH", async () => {
    const expected = { error: { code: "UNAUTHORIZED", message: "Sign in required" } };
    const deleted = await DELETE(context("DELETE", { isAdmin: false, userId: null }));
    expect(deleted.status).toBe(401);
    expect(await deleted.json()).toEqual(expected);

    const patched = await PATCH(context("PATCH", { isAdmin: false, userId: null, body: { status: "reviewed" } }));
    expect(patched.status).toBe(401);
    expect(await patched.json()).toEqual(expected);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("returns 404 NOT_FOUND for a signed-in non-admin and leaves rows", async () => {
    const expected = { error: { code: "NOT_FOUND", message: "Not found" } };
    const deleted = await DELETE(context("DELETE", { isAdmin: false, userId: "member-session" }));
    expect(deleted.status).toBe(404);
    expect(await deleted.json()).toEqual(expected);

    const patched = await PATCH(
      context("PATCH", { isAdmin: false, userId: "member-session", body: { status: "reviewed" } }),
    );
    expect(patched.status).toBe(404);
    expect(await patched.json()).toEqual(expected);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("deletes the matching report and leaves the other row", async () => {
    const response = await DELETE(context("DELETE", { isAdmin: true }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });

    const remaining = await client.from("agent_reports").select("id, title");
    expect(remaining.error).toBeNull();
    expect(remaining.data).toEqual([expect.objectContaining({ id: OTHER_ID, title: "Leave" })]);
  });

  it("returns 404 when the report id is missing from the store", async () => {
    const response = await DELETE(context("DELETE", { isAdmin: true, id: "missing-report" }));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: { code: "NOT_FOUND", message: "Not found" } });

    const remaining = await client.from("agent_reports").select("id");
    expect(remaining.error).toBeNull();
    expect(remaining.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: OTHER_ID }), expect.objectContaining({ id: REPORT_ID })]),
    );
    expect(remaining.data).toHaveLength(2);
  });
});
