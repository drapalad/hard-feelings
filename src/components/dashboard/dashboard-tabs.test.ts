import { describe, expect, it } from "vitest";
import {
  DASHBOARD_TABS,
  DEFAULT_DASHBOARD_TAB,
  applyPlanTabChange,
  dashboardTabHref,
  hasExplicitDashboardTab,
  isDashboardPathname,
  parseDashboardTab,
  selectDashboardTab,
  type DashboardTab,
} from "./dashboard-tabs";

describe("dashboard tabs", () => {
  it("defaults to calendar", () => {
    expect(DEFAULT_DASHBOARD_TAB).toBe("calendar");
  });

  it("lists Calendar, List, then Profile", () => {
    expect(DASHBOARD_TABS.map((tab) => tab.id)).toEqual(["calendar", "list", "profile"]);
    expect(DASHBOARD_TABS.map((tab) => tab.label)).toEqual(["Calendar", "List", "Profile"]);
  });
});

describe("parseDashboardTab", () => {
  it("returns the matching id for calendar, list, and profile", () => {
    expect(parseDashboardTab("calendar")).toBe("calendar");
    expect(parseDashboardTab("list")).toBe("list");
    expect(parseDashboardTab("profile")).toBe("profile");
  });

  it("maps week to calendar", () => {
    expect(parseDashboardTab("week")).toBe("calendar");
  });

  it("returns calendar for missing, empty, wrong-case, and unknown values", () => {
    expect(parseDashboardTab(null)).toBe("calendar");
    expect(parseDashboardTab("")).toBe("calendar");
    expect(parseDashboardTab("Profile")).toBe("calendar");
    expect(parseDashboardTab("admin")).toBe("calendar");
  });
});

describe("selectDashboardTab", () => {
  it("uses List only when the tab query is absent or empty and the viewport is narrow", () => {
    expect(selectDashboardTab(null, true)).toBe("list");
    expect(selectDashboardTab("", true)).toBe("list");
    expect(selectDashboardTab(null, false)).toBe("calendar");
    expect(hasExplicitDashboardTab(null)).toBe(false);
    expect(hasExplicitDashboardTab("")).toBe(false);
  });

  it("lets explicit week, calendar, list, and profile win on a narrow viewport", () => {
    expect(selectDashboardTab("week", true)).toBe("calendar");
    expect(selectDashboardTab("calendar", true)).toBe("calendar");
    expect(selectDashboardTab("list", true)).toBe("list");
    expect(selectDashboardTab("profile", true)).toBe("profile");
    expect(hasExplicitDashboardTab("week")).toBe(true);
    expect(hasExplicitDashboardTab("admin")).toBe(true);
  });
});

describe("dashboardTabHref", () => {
  it("writes pathname plus tab query only when search and hash are empty", () => {
    expect(dashboardTabHref("calendar", "/dashboard", "", "")).toBe("/dashboard?tab=calendar");
    expect(dashboardTabHref("list", "/dashboard")).toBe("/dashboard?tab=list");
    expect(dashboardTabHref("profile", "/dashboard")).toBe("/dashboard?tab=profile");
  });

  it("merges tab into existing search, replaces week or another tab, and keeps the hash", () => {
    expect(dashboardTabHref("profile", "/dashboard", "?tab=week&weekStart=2026-08-31", "#keep")).toBe(
      "/dashboard?tab=profile&weekStart=2026-08-31#keep",
    );
    expect(dashboardTabHref("calendar", "/dashboard", "?foo=1&tab=profile&bar=2", "")).toBe(
      "/dashboard?foo=1&tab=calendar&bar=2",
    );
  });

  it("does not invent weekStart when it was not already in the search", () => {
    const href = dashboardTabHref("calendar", "/dashboard", "", "");
    expect(href).toBe("/dashboard?tab=calendar");
    expect(href).not.toContain("weekStart");
    expect(href).not.toContain("tab=week");
  });
});

describe("isDashboardPathname", () => {
  it("treats /dashboard and /dashboard/ as dashboard", () => {
    expect(isDashboardPathname("/dashboard")).toBe(true);
    expect(isDashboardPathname("/dashboard/")).toBe(true);
    expect(isDashboardPathname("/")).toBe(false);
    expect(isDashboardPathname("/admin")).toBe(false);
  });
});

describe("applyPlanTabChange", () => {
  function deps() {
    const replaceState = (url: string) => {
      calls.replaceState.push(url);
    };
    const assign = (url: string) => {
      calls.assign.push(url);
    };
    const notify = (tab: DashboardTab) => {
      calls.notify.push(tab);
    };
    const calls = {
      replaceState: [] as string[],
      assign: [] as string[],
      notify: [] as DashboardTab[],
      replaceStateFn: replaceState,
      assignFn: assign,
      notifyFn: notify,
    };
    return calls;
  }

  it("replaceStates merged tab and notifies on /dashboard, keeping other params and hash", () => {
    const recorded = deps();
    const result = applyPlanTabChange(
      "list",
      { pathname: "/dashboard", search: "?foo=1&tab=calendar", hash: "#keep" },
      { replaceState: recorded.replaceStateFn, assign: recorded.assignFn, notify: recorded.notifyFn },
    );
    expect(result).toBe("replace");
    expect(recorded.replaceState).toEqual(["/dashboard?foo=1&tab=list#keep"]);
    expect(recorded.notify).toEqual(["list"]);
    expect(recorded.assign).toEqual([]);
  });

  it("treats /dashboard/ as dashboard replaceState", () => {
    const recorded = deps();
    const result = applyPlanTabChange(
      "profile",
      { pathname: "/dashboard/", search: "", hash: "" },
      { replaceState: recorded.replaceStateFn, assign: recorded.assignFn, notify: recorded.notifyFn },
    );
    expect(result).toBe("replace");
    expect(recorded.replaceState).toEqual(["/dashboard/?tab=profile"]);
    expect(recorded.notify).toEqual(["profile"]);
    expect(recorded.assign).toEqual([]);
  });

  it("assigns /dashboard?tab= on / and /admin without replaceState", () => {
    for (const pathname of ["/", "/admin"] as const) {
      const recorded = deps();
      const result = applyPlanTabChange(
        "calendar",
        { pathname, search: "?from=landing", hash: "" },
        { replaceState: recorded.replaceStateFn, assign: recorded.assignFn, notify: recorded.notifyFn },
      );
      expect(result).toBe("assign");
      expect(recorded.assign).toEqual(["/dashboard?tab=calendar"]);
      expect(recorded.replaceState).toEqual([]);
      expect(recorded.notify).toEqual([]);
    }
  });
});
