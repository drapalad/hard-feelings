import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as stagesPost } from "./stages-from-description";

const { harness } = vi.hoisted(() => {
  const state: { apiKey: string; createClient: ReturnType<typeof vi.fn> } = {
    apiKey: "sk-test",
    createClient: vi.fn(),
  };
  return { harness: state };
});

vi.mock("astro:env/server", () => ({
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_KEY: "anon-key",
  get OPENAI_API_KEY() {
    return harness.apiKey;
  },
  OPENAI_MODEL: "gpt-4o-mini",
}));

vi.mock("@/lib/supabase", () => ({
  createClient: harness.createClient,
}));

const EXAMPLE_STAGES = [
  { kind: "warmup", label: "WU", duration: "2 km", target: "" },
  { kind: "work", label: "", duration: "5 km", target: "4:20" },
  { kind: "cooldown", label: "CD", duration: "2 km", target: "" },
];

type RouteHandler = typeof stagesPost;

function signedInContext(body?: unknown): Parameters<RouteHandler>[0] {
  const url = new URL("http://localhost/api/plan/stages-from-description");
  const init: RequestInit = { method: "POST", headers: { "Content-Type": "application/json" } };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  return {
    locals: { user: { id: "member-session" }, isAdmin: false },
    request: new Request(url, init),
    url,
  } as Parameters<RouteHandler>[0];
}

describe("POST /api/plan/stages-from-description", () => {
  beforeEach(() => {
    harness.apiKey = "sk-test";
    harness.createClient.mockReset();
    vi.unstubAllGlobals();
  });

  it("returns the example three stages and never opens a Supabase client", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              choices: [{ message: { content: JSON.stringify({ stages: EXAMPLE_STAGES }) } }],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        ),
      ),
    );

    const response = await stagesPost(signedInContext({ structure: "2km WU, 5km 4:20, 2km CD" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ stages: EXAMPLE_STAGES });
    expect(harness.createClient).not.toHaveBeenCalled();
  });

  it("returns 503 when the API key is missing", async () => {
    harness.apiKey = "";
    const response = await stagesPost(signedInContext({ structure: "2km WU" }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: { code: "UNAVAILABLE", message: "OpenAI is not configured" },
    });
    expect(harness.createClient).not.toHaveBeenCalled();
  });

  it("returns 400 when structure is blank", async () => {
    const response = await stagesPost(signedInContext({ structure: "   " }));
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe("VALIDATION_ERROR");
  });
});

describe("stages-from-description handler source", () => {
  it("does not persist units or send chat", () => {
    const source = readFileSync(path.join(import.meta.dirname, "stages-from-description.ts"), "utf8");
    expect(source).not.toContain("editUnit");
    expect(source).not.toContain("replaceWeek");
    expect(source).not.toContain("/api/chat/messages");
    expect(source).not.toContain("createClient");
    expect(source).toContain("prerender = false");
  });
});
