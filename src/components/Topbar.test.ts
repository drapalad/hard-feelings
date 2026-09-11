import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(path.join(import.meta.dirname, "Topbar.astro"), "utf8");
const tabs = readFileSync(path.join(import.meta.dirname, "dashboard/DashboardTabs.tsx"), "utf8");
const planSelect = readFileSync(path.join(import.meta.dirname, "dashboard/PlanTabSelect.tsx"), "utf8");

describe("Topbar plan nav", () => {
  it("links Calendar, List, and Profile to dashboard tab query params", () => {
    expect(source).toContain('href="/dashboard?tab=calendar"');
    expect(source).toContain('href="/dashboard?tab=list"');
    expect(source).toContain('href="/dashboard?tab=profile"');
    expect(source).toContain("hidden items-center gap-3 sm:flex");
  });

  it("marks the current plan tab as white text with aria-current, not a link", () => {
    expect(source).toContain('Astro.url.pathname === "/dashboard"');
    expect(source).toContain('Astro.url.pathname === "/dashboard/"');
    expect(source).toContain("parseDashboardTab");
    expect(source).toMatch(/<span class="text-white" aria-current="page">/);
    expect(source).toContain('currentPlanTab === "calendar"');
    expect(source).toContain('currentPlanTab === "list"');
    expect(source).toContain('currentPlanTab === "profile"');
  });

  it("uses a client:load Plan select below sm without a GET form submit", () => {
    expect(source).toContain("PlanTabSelect");
    expect(source).toContain("client:load");
    expect(source).toContain("sm:hidden");
    expect(source).not.toContain("this.form.submit()");
    expect(source).not.toContain('method="GET"');
    expect(source).not.toContain('action="/dashboard"');
    expect(planSelect).toContain("<select");
    expect(planSelect).toContain('aria-label="Plan"');
    expect(planSelect).toContain("DASHBOARD_TABS.map");
    expect(planSelect).toContain("{tab.label}");
    expect(planSelect).toContain("applyPlanTabChange");
    expect(planSelect).toContain("history.replaceState");
    expect(planSelect).toContain("location.assign");
  });

  it("does not show the word Dashboard as signed-in chrome", () => {
    expect(source).not.toMatch(/>\s*Dashboard\s*</);
  });

  it("keeps email, Sign out, and Admin unchanged", () => {
    expect(source).toContain("{user.email}");
    expect(source).toContain('method="POST"');
    expect(source).toContain('action="/api/auth/signout"');
    expect(source).toContain("Sign out");
    expect(source).toContain(
      '<a href="/admin" class="text-purple-300 transition-colors hover:text-purple-100 hover:underline">',
    );
  });

  it("does not add a product wordmark or a HardFeelings home link", () => {
    expect(source).not.toMatch(/HardFeelings/);
    expect(source).not.toContain('href="/"');
  });
});

describe("DashboardTabs panels without in-page tablist", () => {
  it("drops the Dashboard tablist and keeps URL-driven panels", () => {
    expect(tabs).not.toContain('role="tablist"');
    expect(tabs).not.toContain('aria-label="Dashboard"');
    expect(tabs).toContain("initialTab");
    expect(tabs).toContain("DASHBOARD_TAB_EVENT");
    expect(tabs).toContain("useState(initialTab)");
    expect(tabs).toContain("<PlanWorkspace");
    expect(tabs).toContain("<PlanList");
    expect(tabs).toContain("<SetupForm");
  });
});
