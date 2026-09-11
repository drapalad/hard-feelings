import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "../../..");

const PHASE_1_3_TESTS = [
  "src/lib/services/ownership.test.ts",
  "src/lib/services/accept-proposition.test.ts",
  "src/lib/services/generate-plan.test.ts",
  "src/pages/api/plan-contracts.test.ts",
  "src/pages/api/product-gates.test.ts",
  "src/lib/test/migration-safety.test.ts",
  "src/lib/test/migration-pg.test.ts",
] as const;

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

function workflowJobIds(ciYaml: string): string[] {
  const parts = ciYaml.split(/^jobs:\n/m);
  const afterJobs = parts.length > 1 ? parts[1] : "";
  return [...afterJobs.matchAll(/^ {2}([A-Za-z0-9_-]+):/gm)].map((match) => match[1]);
}

describe("quality gates (Phase 1–3 floor)", () => {
  it("collects the named Phase 1–3 suites under src/**/*.test.ts", () => {
    expect(readRepoFile("vitest.config.ts")).toContain('include: ["src/**/*.test.ts"]');
    for (const relativePath of PHASE_1_3_TESTS) {
      const absolutePath = path.join(ROOT, relativePath);
      expect(existsSync(absolutePath), relativePath).toBe(true);
      expect(readRepoFile(relativePath)).toMatch(/\bdescribe(\.skipIf)?\(/);
    }
  });

  it("keeps npm test on the single ci job without Docker Postgres, Playwright, or Sentry", () => {
    const ci = readRepoFile(".github/workflows/ci.yml");
    expect(ci).toMatch(/run:\s*npm test/);
    expect(workflowJobIds(ci)).toEqual(["ci"]);
    expect(ci).not.toMatch(/HF_MIGRATION_PG/);
    expect(ci).not.toMatch(/playwright/i);
    expect(ci).not.toMatch(/sentry/i);
  });

  it("wraps the Cloudflare Worker with Sentry", () => {
    expect(readRepoFile("wrangler.jsonc")).toMatch(/"main":\s*"\.\/sentry\.server\.config\.ts"/);
    const wrap = readRepoFile("sentry.server.config.ts");
    expect(wrap).toContain("withSentry");
    expect(wrap).toContain("captureConsoleIntegration");
    expect(wrap).toContain("resolveSentryDsn");
    expect(readRepoFile("src/lib/sentry-enabled.ts")).toContain("SENTRY_ENABLED");
  });

  it("keeps lint-staged, husky typecheck, and afterFileEdit lint + related-tests wiring", () => {
    const pkg = JSON.parse(readRepoFile("package.json")) as {
      scripts?: Record<string, string>;
      "lint-staged"?: Record<string, unknown>;
    };
    expect(pkg.scripts?.typecheck).toBe("astro check");
    expect(pkg["lint-staged"]?.["src/**/*.{ts,tsx}"]).toEqual(["vitest related --run --passWithNoTests"]);
    const preCommit = readRepoFile(".husky/pre-commit");
    expect(preCommit).toContain("npx lint-staged");
    expect(preCommit).toContain("npx astro check");
    const hooks = JSON.parse(readRepoFile(".cursor/hooks.json")) as {
      hooks?: { afterFileEdit?: { command?: string }[] };
    };
    const afterEdit = (hooks.hooks?.afterFileEdit ?? []).map((hook) => hook.command);
    expect(afterEdit).toContain(".cursor/hooks/lint.sh");
    expect(afterEdit).toContain(".cursor/hooks/related-tests.sh");
    expect(existsSync(path.join(ROOT, ".cursor/hooks/lint.sh"))).toBe(true);
    expect(existsSync(path.join(ROOT, ".cursor/hooks/related-tests.sh"))).toBe(true);
  });

  it("leaves Postgres owner-read skippable unless HF_MIGRATION_PG=1", () => {
    expect(readRepoFile("src/lib/test/migration-pg.test.ts")).toContain(
      'describe.skipIf(process.env.HF_MIGRATION_PG !== "1")',
    );
  });
});
