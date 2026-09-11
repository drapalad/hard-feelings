export const DASHBOARD_TABS = [
  { id: "calendar", label: "Calendar" },
  { id: "list", label: "List" },
  { id: "profile", label: "Profile" },
] as const;

export type DashboardTab = (typeof DASHBOARD_TABS)[number]["id"];

export const DEFAULT_DASHBOARD_TAB: DashboardTab = "calendar";

export const MOBILE_MAX_WIDTH_QUERY = "(max-width: 639px)";

const TAB_IDS = new Set<string>(DASHBOARD_TABS.map((tab) => tab.id));

export function parseDashboardTab(raw: string | null): DashboardTab {
  if (raw === "week") {
    return "calendar";
  }
  if (raw !== null && TAB_IDS.has(raw)) {
    return raw as DashboardTab;
  }
  return DEFAULT_DASHBOARD_TAB;
}

export function hasExplicitDashboardTab(raw: string | null): boolean {
  return raw !== null && raw !== "";
}

export function selectDashboardTab(raw: string | null, isNarrowViewport: boolean): DashboardTab {
  if (hasExplicitDashboardTab(raw)) {
    return parseDashboardTab(raw);
  }
  return isNarrowViewport ? "list" : "calendar";
}

export function dashboardTabHref(tab: DashboardTab, pathname: string, search = "", hash = ""): string {
  const params = new URLSearchParams(search);
  params.set("tab", tab);
  return `${pathname}?${params.toString()}${hash}`;
}

export const DASHBOARD_TAB_EVENT = "hf:dashboard-tab";

export function isDashboardPathname(pathname: string): boolean {
  return pathname === "/dashboard" || pathname === "/dashboard/";
}

export interface PlanTabChangeLocation {
  pathname: string;
  search: string;
  hash: string;
}

export interface PlanTabChangeDeps {
  replaceState: (url: string) => void;
  assign: (url: string) => void;
  notify: (tab: DashboardTab) => void;
}

export function applyPlanTabChange(
  tab: DashboardTab,
  location: PlanTabChangeLocation,
  deps: PlanTabChangeDeps,
): "replace" | "assign" {
  if (isDashboardPathname(location.pathname)) {
    const url = dashboardTabHref(tab, location.pathname, location.search, location.hash);
    deps.replaceState(url);
    deps.notify(tab);
    return "replace";
  }
  deps.assign(dashboardTabHref(tab, "/dashboard"));
  return "assign";
}
