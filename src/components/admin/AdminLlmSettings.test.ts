import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(path.join(import.meta.dirname, "AdminLlmSettings.tsx"), "utf8");

describe("AdminLlmSettings coach notes", () => {
  it("has a Coach notes (all members) textarea and PATCHes coachNotes", () => {
    expect(source).toContain("Coach notes (all members)");
    expect(source).toContain("<textarea");
    expect(source).toContain("maxLength={2000}");
    expect(source).toContain("coachNotes:");
    expect(source).toContain('method: "PATCH"');
    expect(source).toContain('id="openai-model"');
    expect(source).toContain("openai-model-suggestions");
  });
});
