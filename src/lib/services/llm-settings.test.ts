import { describe, expect, it } from "vitest";
import { createMemorySupabase } from "@/lib/test/memory-supabase";
import {
  DEFAULT_OPENAI_MODEL,
  getStoredCoachNotes,
  getStoredOpenAiModel,
  loadOpenAiModel,
  openaiModelIdSchema,
  resolveOpenAiModel,
  setStoredCoachNotes,
  setStoredOpenAiModel,
} from "./llm-settings";

const ADMIN_ID = "admin-user";

describe("openaiModelIdSchema", () => {
  it("accepts gpt-4o-mini and gpt-5.6-luna", () => {
    expect(openaiModelIdSchema.parse("gpt-4o-mini")).toBe("gpt-4o-mini");
    expect(openaiModelIdSchema.parse("gpt-5.6-luna")).toBe("gpt-5.6-luna");
    expect(openaiModelIdSchema.parse("  gpt-4o-mini  ")).toBe("gpt-4o-mini");
  });

  it("rejects empty, spaces, over-64, and illegal charset", () => {
    expect(openaiModelIdSchema.safeParse("").success).toBe(false);
    expect(openaiModelIdSchema.safeParse("   ").success).toBe(false);
    expect(openaiModelIdSchema.safeParse("gpt 4o").success).toBe(false);
    expect(openaiModelIdSchema.safeParse("a".repeat(65)).success).toBe(false);
    expect(openaiModelIdSchema.safeParse("gpt-4o/mini").success).toBe(false);
  });
});

describe("resolveOpenAiModel", () => {
  it("prefers a stored override over env and default", () => {
    expect(resolveOpenAiModel("gpt-5.6-luna", "gpt-4o")).toBe("gpt-5.6-luna");
  });

  it("uses env when stored is unset", () => {
    expect(resolveOpenAiModel(null, "gpt-4o")).toBe("gpt-4o");
    expect(resolveOpenAiModel(undefined, "gpt-4o")).toBe("gpt-4o");
  });

  it("falls back to gpt-4o-mini when both are empty", () => {
    expect(resolveOpenAiModel(null, undefined)).toBe(DEFAULT_OPENAI_MODEL);
    expect(resolveOpenAiModel(null, "")).toBe("gpt-4o-mini");
    expect(resolveOpenAiModel(undefined, "")).toBe("gpt-4o-mini");
  });

  it("treats stored blank or whitespace as unset and uses env", () => {
    expect(resolveOpenAiModel("", "gpt-4o")).toBe("gpt-4o");
    expect(resolveOpenAiModel("   ", "gpt-4o")).toBe("gpt-4o");
  });
});

describe("getStoredOpenAiModel / setStoredOpenAiModel", () => {
  it("returns null on an empty store", async () => {
    const client = createMemorySupabase();
    expect(await getStoredOpenAiModel(client)).toBeNull();
  });

  it("round-trips a stored model and clears to null", async () => {
    const client = createMemorySupabase();
    await setStoredOpenAiModel(client, "gpt-5.6-luna", ADMIN_ID);
    expect(await getStoredOpenAiModel(client)).toBe("gpt-5.6-luna");
    expect(await loadOpenAiModel(client, "gpt-4o")).toBe("gpt-5.6-luna");

    await setStoredOpenAiModel(client, null, ADMIN_ID);
    expect(await getStoredOpenAiModel(client)).toBeNull();
    expect(await loadOpenAiModel(client, "gpt-4o")).toBe("gpt-4o");
    expect(await loadOpenAiModel(client, "")).toBe("gpt-4o-mini");
  });
});

describe("getStoredCoachNotes / setStoredCoachNotes", () => {
  it("returns null on an empty store", async () => {
    const client = createMemorySupabase();
    expect(await getStoredCoachNotes(client)).toBeNull();
  });

  it("round-trips notes and clears to null", async () => {
    const client = createMemorySupabase();
    await setStoredCoachNotes(client, "Keep long easy", ADMIN_ID);
    expect(await getStoredCoachNotes(client)).toBe("Keep long easy");

    await setStoredCoachNotes(client, null, ADMIN_ID);
    expect(await getStoredCoachNotes(client)).toBeNull();
  });

  it("keeps notes when only the model is upserted", async () => {
    const client = createMemorySupabase();
    await setStoredCoachNotes(client, "Keep long easy", ADMIN_ID);
    await setStoredOpenAiModel(client, "gpt-5.6-luna", ADMIN_ID);
    expect(await getStoredCoachNotes(client)).toBe("Keep long easy");
    expect(await getStoredOpenAiModel(client)).toBe("gpt-5.6-luna");
  });
});
