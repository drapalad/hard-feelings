import React, { useEffect, useState } from "react";
import SetupForm from "@/components/setup/SetupForm";
import PlanList from "@/components/plan/PlanList";
import PlanWorkspace from "@/components/plan/PlanWorkspace";
import { DASHBOARD_TAB_EVENT, parseDashboardTab, type DashboardTab } from "./dashboard-tabs";
import type { ChatMessage, PlanRevisionSummary, Race, TrainingUnit, Weekday, WorkoutLog } from "@/types";

interface DashboardTabsProps {
  initialTab: DashboardTab;
  weeklyKm: number | null;
  longWeekdays: Weekday[];
  restWeekdays: Weekday[];
  mixEasy: number;
  mixThreshold: number;
  mixSpeed: number;
  lastRaceDate: string | null;
  lastRaceKm: number | null;
  lastRaceTimeSec: number | null;
  coachNotes: string | null;
  races: Race[];
  weekStart: string;
  units: TrainingUnit[];
  logs: WorkoutLog[];
  messages: ChatMessage[];
  revisions: PlanRevisionSummary[];
}

export default function DashboardTabs({
  initialTab,
  weeklyKm,
  longWeekdays,
  restWeekdays,
  mixEasy,
  mixThreshold,
  mixSpeed,
  lastRaceDate,
  lastRaceKm,
  lastRaceTimeSec,
  coachNotes,
  races,
  weekStart,
  units,
  logs,
  messages,
  revisions,
}: DashboardTabsProps) {
  const [selected, setSelected] = useState(initialTab);
  const [liveRaces, setLiveRaces] = useState<Race[]>(races);

  useEffect(() => {
    function syncFromEvent(event: Event) {
      const detail = (event as CustomEvent<DashboardTab>).detail;
      setSelected(parseDashboardTab(typeof detail === "string" ? detail : null));
    }
    function syncFromPopState() {
      setSelected(parseDashboardTab(new URLSearchParams(window.location.search).get("tab")));
    }
    window.addEventListener(DASHBOARD_TAB_EVENT, syncFromEvent);
    window.addEventListener("popstate", syncFromPopState);
    return () => {
      window.removeEventListener(DASHBOARD_TAB_EVENT, syncFromEvent);
      window.removeEventListener("popstate", syncFromPopState);
    };
  }, []);

  return (
    <div className="space-y-4">
      <div hidden={selected !== "calendar"}>
        <PlanWorkspace
          weekStart={weekStart}
          units={units}
          races={liveRaces}
          logs={logs}
          messages={messages}
          revisions={revisions}
        />
      </div>
      <div hidden={selected !== "list"}>
        <PlanList active={selected === "list"} races={liveRaces} />
      </div>
      <div hidden={selected !== "profile"}>
        <SetupForm
          weeklyKm={weeklyKm}
          longWeekdays={longWeekdays}
          restWeekdays={restWeekdays}
          mixEasy={mixEasy}
          mixThreshold={mixThreshold}
          mixSpeed={mixSpeed}
          lastRaceDate={lastRaceDate}
          lastRaceKm={lastRaceKm}
          lastRaceTimeSec={lastRaceTimeSec}
          coachNotes={coachNotes}
          races={liveRaces}
          onRacesChange={setLiveRaces}
        />
      </div>
    </div>
  );
}
