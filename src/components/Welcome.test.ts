import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(path.join(import.meta.dirname, "Welcome.astro"), "utf8");

const primaryClass =
  "inline-flex items-center justify-center rounded-lg bg-purple-600 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-purple-500";
const signUpClass =
  "inline-flex items-center justify-center rounded-lg border border-white/20 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-white/10";

function signedInBranch(src: string): string {
  const afterUser = src.split(/user\s*\?/)[1];
  expect(afterUser).toBeDefined();
  const branch = afterUser.split(/\)\s*:\s*\(/)[0];
  expect(branch).toBeDefined();
  return branch;
}

describe("Welcome hero CTAs", () => {
  it("reads Astro.locals.user", () => {
    expect(source).toContain("const { user } = Astro.locals");
  });

  it("signed-in hero is Open dashboard linking to /dashboard", () => {
    const signedIn = signedInBranch(source);
    expect(signedIn).toContain('href="/dashboard"');
    expect(signedIn).toContain("Open dashboard");
    expect(signedIn).toContain(primaryClass);
    expect(signedIn).not.toContain("Sign In");
    expect(signedIn).not.toContain("Sign Up");
    expect(signedIn).not.toContain("/auth/signin");
    expect(signedIn).not.toContain("/auth/signup");
  });

  it("signed-out hero keeps Sign In and Sign Up hrefs and styles", () => {
    expect(source).toContain('href="/auth/signin"');
    expect(source).toContain('href="/auth/signup"');
    expect(source).toContain(`class="${primaryClass}"`);
    expect(source).toContain(`class="${signUpClass}"`);
    expect(source).toMatch(/>\s*Sign In\s*</);
    expect(source).toMatch(/>\s*Sign Up\s*</);
  });

  it("does not mount a client island on Welcome", () => {
    expect(source).not.toContain("client:load");
    expect(source).not.toContain("client:idle");
    expect(source).not.toContain('"use client"');
  });
});
