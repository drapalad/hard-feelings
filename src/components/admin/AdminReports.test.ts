import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(path.join(import.meta.dirname, "AdminReports.tsx"), "utf8");

describe("AdminReports technical payload", () => {
  it("splits body on the machine marker and renders a Technical payload pre", () => {
    expect(source).toContain("Technical payload");
    expect(source).toContain("<pre");
    expect(source).toContain("<!--hf-technical-payload-->");
    expect(source).toContain("whitespace-pre-wrap");
    expect(source).not.toContain("@/lib/services/agent-report");
  });
});

describe("AdminReports collapsed list", () => {
  it("defaults to closed details with date and title in summary, and a Delete control", () => {
    expect(source).toContain("<details");
    expect(source).not.toContain("<details open");
    expect(source).toContain("<summary");
    expect(source).toContain("createdAt.slice(0, 10)");
    expect(source).toContain("{report.title}");
    expect(source).toContain("Delete");
    expect(source).toContain('method: "DELETE"');
  });
});
