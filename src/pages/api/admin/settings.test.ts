import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { createMemorySupabase } from "@/lib/test/memory-supabase";
import { GET, PATCH } from "./settings";

vi.mock("astro:env/server", () => ({
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_KEY: "anon-key",
  OPENAI_API_KEY: "",
  OPENAI_MODEL: "gpt-4o",
}));

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(),
}));

const ADMIN_ID = "admin-user";

function context(method: string, options: { isAdmin: boolean; body?: unknown }): Parameters<APIRoute>[0] {
  const url = new URL("http://localhost/api/admin/settings");
  const init: RequestInit = { method };
  if (options.body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(options.body);
  }
  return {
    locals: { user: { id: ADMIN_ID }, isAdmin: options.isAdmin },
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

describe("GET/PATCH /api/admin/settings", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReturnValue(createMemorySupabase());
  });

  it("returns 404 NOT_FOUND for a signed-in non-admin", async () => {
    const expected = { error: { code: "NOT_FOUND", message: "Not found" } };
    const getResponse = await GET(context("GET", { isAdmin: false }));
    expect(getResponse.status).toBe(404);
    expect(await getResponse.json()).toEqual(expected);
    expect(createClient).not.toHaveBeenCalled();

    const patchResponse = await PATCH(context("PATCH", { isAdmin: false, body: { openaiModel: "gpt-4o-mini" } }));
    expect(patchResponse.status).toBe(404);
    expect(await patchResponse.json()).toEqual(expected);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("round-trips an admin save and GET", async () => {
    const patchResponse = await PATCH(context("PATCH", { isAdmin: true, body: { openaiModel: "gpt-5.6-luna" } }));
    expect(patchResponse.status).toBe(200);
    expect(await patchResponse.json()).toEqual({
      openaiModel: "gpt-5.6-luna",
      resolvedModel: "gpt-5.6-luna",
      envFallback: "gpt-4o",
      coachNotes: null,
    });

    const getResponse = await GET(context("GET", { isAdmin: true }));
    expect(getResponse.status).toBe(200);
    expect(await getResponse.json()).toEqual({
      openaiModel: "gpt-5.6-luna",
      resolvedModel: "gpt-5.6-luna",
      envFallback: "gpt-4o",
      coachNotes: null,
    });
  });

  it("round-trips coachNotes, clamps, stores empty as null, and omits to preserve", async () => {
    const saved = await PATCH(
      context("PATCH", { isAdmin: true, body: { openaiModel: "gpt-4o-mini", coachNotes: "Keep long easy" } }),
    );
    expect(saved.status).toBe(200);
    expect(await saved.json()).toEqual({
      openaiModel: "gpt-4o-mini",
      resolvedModel: "gpt-4o-mini",
      envFallback: "gpt-4o",
      coachNotes: "Keep long easy",
    });

    const extraOwner = await PATCH(
      context("PATCH", {
        isAdmin: true,
        body: { openaiModel: "gpt-4o-mini", coachNotes: "Keep long easy", userId: "forged", user_id: "forged" },
      }),
    );
    expect(extraOwner.status).toBe(200);
    expect(await extraOwner.json()).toMatchObject({ coachNotes: "Keep long easy" });

    const empty = await PATCH(
      context("PATCH", { isAdmin: true, body: { openaiModel: "gpt-4o-mini", coachNotes: "" } }),
    );
    expect(empty.status).toBe(200);
    expect(await empty.json()).toMatchObject({ coachNotes: null });

    const restored = await PATCH(
      context("PATCH", { isAdmin: true, body: { openaiModel: "gpt-4o-mini", coachNotes: "Keep Sundays long" } }),
    );
    expect(restored.status).toBe(200);

    const clamped = await PATCH(
      context("PATCH", { isAdmin: true, body: { openaiModel: "gpt-4o-mini", coachNotes: "a".repeat(2001) } }),
    );
    expect(clamped.status).toBe(200);
    const clampedBody = (await clamped.json()) as { coachNotes: string };
    expect(clampedBody.coachNotes).toHaveLength(2000);

    const modelOnly = await PATCH(context("PATCH", { isAdmin: true, body: { openaiModel: "gpt-5.6-luna" } }));
    expect(modelOnly.status).toBe(200);
    expect(await modelOnly.json()).toEqual({
      openaiModel: "gpt-5.6-luna",
      resolvedModel: "gpt-5.6-luna",
      envFallback: "gpt-4o",
      coachNotes: "a".repeat(2000),
    });

    const invalid = await PATCH(context("PATCH", { isAdmin: true, body: { openaiModel: "gpt 4o", coachNotes: "x" } }));
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });
});
