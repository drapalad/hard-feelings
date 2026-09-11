import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workspace = readFileSync(path.join(import.meta.dirname, "PlanWorkspace.tsx"), "utf8");
const tabs = readFileSync(path.join(import.meta.dirname, "../dashboard/DashboardTabs.tsx"), "utf8");
const chat = readFileSync(path.join(import.meta.dirname, "PlanChat.tsx"), "utf8");

describe("PlanWorkspace month layout", () => {
  it("uses a 3/2 large-screen split and keeps the small-screen stack", () => {
    expect(workspace).toContain("flex flex-col gap-6 lg:flex-row");
    expect(workspace).toContain("min-w-0 flex-1 overflow-hidden");
    expect(workspace).toContain("lg:w-[420px] lg:max-w-[420px]");
    expect(workspace).not.toContain("lg:grid-cols-5");
  });

  it("does not pass week emptiness into PlanChat", () => {
    expect(workspace).not.toContain("unitsEmpty={!weekHasUnits(units, weekStart)}");
    expect(workspace).not.toContain("unitsEmpty");
    expect(chat).toContain("The coach starts from your profile and current load.");
  });

  it("loads the month with from/to and merges week mutations", () => {
    expect(workspace).toContain("&from=${from}&to=${to}");
    expect(workspace).toContain("mergeWeekSlice(current, nextLogs, sliceWeekStart)");
    expect(workspace).toContain("JSON.stringify({ weekStart })");
  });

  it("loads the eight-week chart window and merges it with the month payload by date", () => {
    expect(workspace).toContain("loadChartWindow");
    expect(workspace).toContain("from=${chart.from}&to=${chart.to}");
    expect(workspace).toContain("mergeByDate(nextUnits, chartUnits)");
    expect(workspace).toContain("mergeByDate(nextLogs, chartLogs)");
  });

  it("starts a canned coach send from onGenerate and fills the ISO week via POST /api/plan", () => {
    expect(workspace).toContain("generateHorizonPrompt");
    expect(workspace).toContain("void send(generateHorizonPrompt");
    expect(workspace).toContain("hasUnitInHorizon");
    expect(workspace).toContain("void generateWeek()");
    expect(workspace).toContain('fetch("/api/plan"');
    expect(workspace).toContain("plan.units");
    expect(workspace).toContain("mergeWeekSlice(current, nextUnits, monday)");
    expect(workspace).toContain("mergeReturnedUnits");
  });

  it("merges Send units in the workspace and does not call reject for ordinary chat turns", () => {
    expect(workspace).toContain("mergeReturnedUnits(current, nextUnits, weekStart)");
    expect(workspace).not.toContain('fetch("/api/chat/reject"');
    expect(workspace).not.toContain("setProposition");
    expect(workspace).not.toContain("asProposition");
    expect(workspace).not.toContain("proposition: PlanProposition");
    expect(tabs).not.toContain("proposition");
    expect(workspace).toContain("hardViolations={hardViolations}");
    expect(workspace).toMatch(/validation\.hard\.length > 0[\s\S]*?setWarnings\(\[\]\)/);
  });

  it("stores an optimistic user row and thinking state during send", () => {
    expect(workspace).toContain("const [optimisticMessages, setOptimisticMessages] = useState<ChatMessage[]>([])");
    expect(workspace).toContain("id: `pending-${Date.now()}`");
    expect(workspace).toContain("setShowThinking(true)");
    expect(workspace).toContain("setOptimisticMessages([])");
    expect(workspace).toContain("setShowThinking(false)");
    expect(workspace).toContain("optimisticMessages={optimisticMessages}");
    expect(workspace).toContain("showThinking={showThinking}");
  });

  it("posts flag-for-admin from the workspace and keeps session-local reported ids", () => {
    expect(workspace).toContain('fetch("/api/chat/report"');
    expect(workspace).toContain("const [reportedMessageIds, setReportedMessageIds] = useState<string[]>([])");
    expect(workspace).toContain(
      "setReportedMessageIds((current) => (current.includes(messageId) ? current : [...current, messageId]))",
    );
    expect(workspace).toContain("reportedMessageIds={reportedMessageIds}");
    expect(workspace).toContain("reportingMessageId={reportingMessageId}");
  });

  it("tracks pending profile/freeze review state and calls accept/dismiss routes", () => {
    expect(workspace).toContain('fetch("/api/chat/accept"');
    expect(workspace).toContain('fetch("/api/chat/dismiss"');
    expect(workspace).toContain(
      "const [pendingProfileFreeze, setPendingProfileFreeze] = useState<PendingProfileFreeze | null>(null)",
    );
    expect(workspace).toContain("function parsePendingCreates");
    expect(workspace).toContain("pendingProfileFreeze={pendingProfileFreeze}");
    expect(workspace).toContain("reviewBusy={reviewBusy}");
    expect(workspace).toContain("function asPendingProfileFreeze");
    expect(workspace).toContain("parsePendingRaces");
  });

  it("passes session loadedRange into PlanChat from the messages response", () => {
    expect(workspace).toContain("loadedRange={loadedRange}");
    expect(workspace).toContain("asLoadedRange(body.loadedRange)");
    expect(workspace).toContain("setLoadedRange(null)");
    expect(workspace).not.toContain('from "@/lib/services/openai-chat"');
    expect(workspace).not.toContain("/api/chat/data");
  });

  it("posts a new thread, sends with threadId, and keeps month nav on the active thread", () => {
    expect(workspace).toContain('fetch("/api/chat/threads"');
    expect(workspace).toContain("activeThreadIdRef");
    expect(workspace).toContain("/api/chat?weekStart=${nextStart}&threadId=");
    expect(workspace).toContain("/api/chat?weekStart=${weekStart}&threadId=");
    expect(workspace).toContain("{ weekStart, content: trimmed, threadId }");
    expect(workspace).toContain("void newThread()");
    expect(workspace).toContain("void selectThread(threadId)");
    expect(workspace).toContain("setMessages([])");
    expect(workspace).toContain("[applyChatBody]");
    expect(workspace).not.toContain("[applyChatBody, activeThreadId]");
  });

  it("saves a week snapshot via POST /api/plan/snapshots", () => {
    expect(workspace).toContain("/api/plan/snapshots");
    expect(workspace).toContain("latestSnapshotUnits");
    expect(workspace).toContain("unitsInWeek");
    expect(workspace).toContain("weekUnitsEqual");
    expect(workspace).toContain("snapshotDirty");
  });

  it("passes month logs into the calendar", () => {
    expect(workspace).toContain("logs={logs}");
    expect(workspace).not.toContain("_logs");
  });

  it("merges unit and log mutations into month state", () => {
    expect(workspace).toContain('method: "PUT"');
    expect(workspace).toContain('method: "PATCH"');
    expect(workspace).toContain('method: "DELETE"');
    expect(workspace).toContain("/api/plan/units");
    expect(workspace).toContain("/api/plan/units?date=${date}");
    expect(workspace).toContain("/api/plan/logs");
    expect(workspace).toContain("JSON.stringify({ date, distanceKm, avgPaceSecPerKm, avgHr })");
    expect(workspace).toContain("mergeWeekSlice(current, nextUnits, actionMonday)");
    expect(workspace).toContain("mergeWeekSlice(current, nextLogs, utcMondayOf(date))");
    expect(workspace).toContain("mergeItemByDate");
    expect(workspace).toContain("actionMonday === weekStart");
    expect(workspace).toContain("logs={logs}");
  });

  it("threads live races state into Calendar, List, and Profile", () => {
    expect(tabs).toContain("liveRaces");
    expect(tabs).toContain("<PlanWorkspace");
    expect(tabs).toContain("<SetupForm");
    const workspaceOpen = tabs.indexOf("<PlanWorkspace");
    const setupOpen = tabs.indexOf("<SetupForm");
    expect(workspaceOpen).toBeGreaterThan(-1);
    expect(setupOpen).toBeGreaterThan(-1);
    expect(tabs.slice(workspaceOpen, tabs.indexOf("/>", workspaceOpen))).toContain("races={liveRaces}");
    expect(tabs.slice(setupOpen, tabs.indexOf("/>", setupOpen))).toContain("races={liveRaces}");
    expect(tabs).toContain("onRacesChange={setLiveRaces}");
    expect(workspace).toContain("races: Race[]");
    expect(workspace).toContain("races={races}");
    expect(workspace).toContain("<PlanCalendar");
  });
});
