import React from "react";
import {
  DASHBOARD_TAB_EVENT,
  DASHBOARD_TABS,
  applyPlanTabChange,
  parseDashboardTab,
  type DashboardTab,
} from "./dashboard-tabs";

interface PlanTabSelectProps {
  currentTab: DashboardTab;
}

export default function PlanTabSelect({ currentTab }: PlanTabSelectProps) {
  function onChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const tab = parseDashboardTab(event.target.value);
    applyPlanTabChange(tab, window.location, {
      replaceState: (url) => {
        history.replaceState(history.state, "", url);
      },
      assign: (url) => {
        window.location.assign(url);
      },
      notify: (next) => {
        window.dispatchEvent(new CustomEvent(DASHBOARD_TAB_EVENT, { detail: next }));
      },
    });
  }

  return (
    <select
      aria-label="Plan"
      className="rounded-md border border-white/10 bg-white/10 px-2 py-1 text-sm text-white"
      defaultValue={currentTab}
      onChange={onChange}
    >
      {DASHBOARD_TABS.map((tab) => (
        <option key={tab.id} value={tab.id}>
          {tab.label}
        </option>
      ))}
    </select>
  );
}
