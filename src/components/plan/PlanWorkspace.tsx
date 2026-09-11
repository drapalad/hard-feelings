import React, { useCallback, useEffect, useRef, useState } from "react";
import PlanCalendar, { type UnitEditPayload } from "./PlanCalendar";
import PlanChat from "./PlanChat";
import {
  mergeItemByDate,
  mergeReturnedUnits,
  mergeWeekSlice,
  unitsInWeek,
  weekUnitsEqual,
  generateHorizonPrompt,
  hasUnitInHorizon,
} from "./plan-month";
import { loadChartWindow } from "./training-load";
import {
  activeWeekStartForMonth,
  addUtcDays,
  addUtcMonths,
  monthGridDates,
  utcMondayOf,
  utcMonthStart,
  utcToday,
} from "@/lib/dates";
import type {
  BoundViolation,
  ChatMessage,
  ChatThread,
  PlanRevisionSummary,
  PendingProfileFreeze,
  Race,
  TrainingUnit,
  LoadedRange,
  ValidateResult,
  WorkoutLog,
} from "@/types";

interface PlanWorkspaceProps {
  weekStart: string;
  units: TrainingUnit[];
  races: Race[];
  logs: WorkoutLog[];
  messages: ChatMessage[];
  revisions: PlanRevisionSummary[];
}

interface ApiErrorBody {
  code: string;
  message: string;
}

function readError(body: unknown): ApiErrorBody {
  if (typeof body !== "object" || body === null || !("error" in body)) {
    return { code: "UNKNOWN", message: "Request failed" };
  }
  const error = body.error;
  if (typeof error !== "object" || error === null) {
    return { code: "UNKNOWN", message: "Request failed" };
  }
  const code = "code" in error && typeof error.code === "string" ? error.code : "UNKNOWN";
  const message = "message" in error && typeof error.message === "string" ? error.message : "Request failed";
  return { code, message };
}

async function readBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function asUnits(value: unknown): TrainingUnit[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  return value as TrainingUnit[];
}

function asLogs(value: unknown): WorkoutLog[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  return value as WorkoutLog[];
}

function asMessages(value: unknown): ChatMessage[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  return value as ChatMessage[];
}

function asThread(value: unknown): ChatThread | null {
  if (typeof value !== "object" || value === null || !("id" in value) || !("startedAt" in value)) {
    return null;
  }
  if (typeof value.id !== "string" || typeof value.startedAt !== "string") {
    return null;
  }
  const title = "title" in value && typeof value.title === "string" && value.title !== "" ? value.title : null;
  return { id: value.id, title, startedAt: value.startedAt };
}

function asThreads(value: unknown): ChatThread[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  return value.flatMap((item) => {
    const thread = asThread(item);
    return thread === null ? [] : [thread];
  });
}

function asLoadedRange(value: unknown): LoadedRange | null {
  if (
    typeof value !== "object" ||
    value === null ||
    !("from" in value) ||
    !("to" in value) ||
    typeof value.from !== "string" ||
    typeof value.to !== "string"
  ) {
    return null;
  }
  return { from: value.from, to: value.to };
}

function asPendingProfileFreeze(value: unknown): PendingProfileFreeze | null {
  if (typeof value !== "object" || value === null || !("id" in value) || !("weekStart" in value)) {
    return null;
  }
  if (typeof value.id !== "string" || typeof value.weekStart !== "string") {
    return null;
  }
  const freeze =
    "freeze" in value && Array.isArray(value.freeze) ? value.freeze.filter((item) => typeof item === "string") : [];
  const unfreeze =
    "unfreeze" in value && Array.isArray(value.unfreeze)
      ? value.unfreeze.filter((item) => typeof item === "string")
      : [];
  const profile =
    "profile" in value && typeof value.profile === "object" && value.profile !== null ? value.profile : undefined;
  const races = "races" in value ? parsePendingRaces(value.races) : undefined;
  const creates = "creates" in value ? parsePendingCreates(value.creates) : undefined;
  return {
    id: value.id,
    weekStart: value.weekStart,
    ...(profile === undefined ? {} : { profile }),
    freeze,
    unfreeze,
    ...(races === undefined ? {} : { races }),
    ...(creates === undefined ? {} : { creates }),
  };
}

function unknownItems(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function parsePendingRaceAdd(value: unknown): NonNullable<PendingProfileFreeze["races"]>["add"][number] | null {
  if (typeof value !== "object" || value === null || !("date" in value) || !("priority" in value)) {
    return null;
  }
  if (typeof value.date !== "string") {
    return null;
  }
  if (value.priority !== "A" && value.priority !== "B" && value.priority !== "C" && value.priority !== "D") {
    return null;
  }
  const row: NonNullable<PendingProfileFreeze["races"]>["add"][number] = {
    date: value.date,
    priority: value.priority,
  };
  if ("name" in value && typeof value.name === "string" && value.name !== "") {
    row.name = value.name;
  }
  if ("goal" in value && typeof value.goal === "string" && value.goal !== "") {
    row.goal = value.goal;
  }
  return row;
}

function parsePendingRaceRemove(value: unknown): NonNullable<PendingProfileFreeze["races"]>["remove"][number] | null {
  if (
    typeof value !== "object" ||
    value === null ||
    !("id" in value) ||
    typeof value.id !== "string" ||
    value.id === ""
  ) {
    return null;
  }
  return { id: value.id };
}

function parsePendingRacePatch(value: unknown): NonNullable<PendingProfileFreeze["races"]>["patch"][number] | null {
  if (
    typeof value !== "object" ||
    value === null ||
    !("id" in value) ||
    typeof value.id !== "string" ||
    value.id === ""
  ) {
    return null;
  }
  const row: NonNullable<PendingProfileFreeze["races"]>["patch"][number] = { id: value.id };
  if ("date" in value && typeof value.date === "string") {
    row.date = value.date;
  }
  if (
    "priority" in value &&
    (value.priority === "A" || value.priority === "B" || value.priority === "C" || value.priority === "D")
  ) {
    row.priority = value.priority;
  }
  if ("name" in value && typeof value.name === "string" && value.name !== "") {
    row.name = value.name;
  }
  if ("goal" in value && typeof value.goal === "string" && value.goal !== "") {
    row.goal = value.goal;
  }
  return row;
}

function parsePendingCreates(value: unknown): PendingProfileFreeze["creates"] {
  const creates = unknownItems(value).flatMap((item) => {
    const parsed = parsePendingCreate(item);
    return parsed === null ? [] : [parsed];
  });
  return creates.length === 0 ? undefined : creates;
}

function parsePendingCreate(value: unknown): NonNullable<PendingProfileFreeze["creates"]>[number] | null {
  if (typeof value !== "object" || value === null || !("date" in value) || typeof value.date !== "string") {
    return null;
  }
  if (!("type" in value) || !isPendingCreateType(value.type)) {
    return null;
  }
  if (!("distanceKm" in value) || typeof value.distanceKm !== "number" || !Number.isFinite(value.distanceKm)) {
    return null;
  }
  const create: NonNullable<PendingProfileFreeze["creates"]>[number] = {
    date: value.date,
    type: value.type,
    distanceKm: value.distanceKm,
  };
  if ("structure" in value && typeof value.structure === "string" && value.structure !== "") {
    create.structure = value.structure;
  }
  return create;
}

function isPendingCreateType(
  value: unknown,
): value is NonNullable<NonNullable<PendingProfileFreeze["creates"]>[number]["type"]> {
  return (
    value === "base" ||
    value === "recovery" ||
    value === "tempo" ||
    value === "threshold" ||
    value === "anaerobic" ||
    value === "long"
  );
}

function parsePendingRaces(value: unknown): PendingProfileFreeze["races"] {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const add = unknownItems("add" in value ? value.add : undefined).flatMap((item) => {
    const parsed = parsePendingRaceAdd(item);
    return parsed === null ? [] : [parsed];
  });
  const remove = unknownItems("remove" in value ? value.remove : undefined).flatMap((item) => {
    const parsed = parsePendingRaceRemove(item);
    return parsed === null ? [] : [parsed];
  });
  const patch = unknownItems("patch" in value ? value.patch : undefined).flatMap((item) => {
    const parsed = parsePendingRacePatch(item);
    return parsed === null ? [] : [parsed];
  });
  if (add.length === 0 && remove.length === 0 && patch.length === 0) {
    return undefined;
  }
  return { add, remove, patch };
}

function asSoft(value: unknown): BoundViolation[] {
  if (typeof value !== "object" || value === null || !("soft" in value) || !Array.isArray(value.soft)) {
    return [];
  }
  return value.soft as BoundViolation[];
}

function asWarnings(value: unknown): BoundViolation[] {
  if (typeof value !== "object" || value === null) {
    return [];
  }
  const hard = "hard" in value && Array.isArray(value.hard) ? (value.hard as BoundViolation[]) : [];
  const soft = "soft" in value && Array.isArray(value.soft) ? (value.soft as BoundViolation[]) : [];
  return [...hard, ...soft];
}

function asUnit(value: unknown): TrainingUnit | null {
  if (typeof value !== "object" || value === null || !("date" in value) || typeof value.date !== "string") {
    return null;
  }
  return value as TrainingUnit;
}

function isRevisionSummary(item: unknown): item is PlanRevisionSummary {
  if (typeof item !== "object" || item === null) {
    return false;
  }
  if (!("id" in item) || !("createdAt" in item)) {
    return false;
  }
  return typeof item.id === "string" && typeof item.createdAt === "string";
}

function asLatestSnapshotUnits(value: unknown): TrainingUnit[] | null {
  if (typeof value !== "object" || value === null || !("latestSnapshotUnits" in value)) {
    return null;
  }
  if (value.latestSnapshotUnits === null) {
    return null;
  }
  return asUnits(value.latestSnapshotUnits);
}

function asRevisions(value: unknown): PlanRevisionSummary[] | null {
  if (typeof value !== "object" || value === null || !("revisions" in value) || !Array.isArray(value.revisions)) {
    return null;
  }
  const summaries = value.revisions.filter(isRevisionSummary);
  return summaries;
}

function mergeByDate<T extends { date: string }>(left: T[], right: T[]): T[] {
  const byDate = new Map<string, T>();
  for (const item of left) {
    byDate.set(item.date, item);
  }
  for (const item of right) {
    byDate.set(item.date, item);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function applyStack(body: unknown, setHistory: (value: PlanRevisionSummary[]) => void) {
  const nextRevisions = asRevisions(body);
  if (nextRevisions !== null) {
    setHistory(nextRevisions);
  }
}

function asValidation(value: unknown): ValidateResult | null {
  if (typeof value !== "object" || value === null || !("hard" in value) || !("soft" in value)) {
    return null;
  }
  if (!Array.isArray(value.hard) || !Array.isArray(value.soft)) {
    return null;
  }
  return value as ValidateResult;
}

export default function PlanWorkspace({
  weekStart: initialWeekStart,
  units: initialUnits,
  races,
  logs: initialLogs,
  messages: initialMessages,
  revisions: initialRevisions,
}: PlanWorkspaceProps) {
  const [weekStart, setWeekStart] = useState(initialWeekStart);
  const [visibleMonth, setVisibleMonth] = useState(() => utcMonthStart(utcToday()));
  const [units, setUnits] = useState(initialUnits);
  const [logs, setLogs] = useState(initialLogs);
  const [messages, setMessages] = useState(initialMessages);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [optimisticMessages, setOptimisticMessages] = useState<ChatMessage[]>([]);
  const [pendingProfileFreeze, setPendingProfileFreeze] = useState<PendingProfileFreeze | null>(null);
  const [revisions, setRevisions] = useState(initialRevisions);
  const [latestSnapshotUnits, setLatestSnapshotUnits] = useState<TrainingUnit[] | null>(null);
  const [calendarError, setCalendarError] = useState<string | undefined>();
  const [chatError, setChatError] = useState<string | undefined>();
  const [warnings, setWarnings] = useState<BoundViolation[]>([]);
  const [hardViolations, setHardViolations] = useState<BoundViolation[]>([]);
  const [loadedRange, setLoadedRange] = useState<LoadedRange | null>(null);
  const [reportedMessageIds, setReportedMessageIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [showThinking, setShowThinking] = useState(false);
  const [reportingMessageId, setReportingMessageId] = useState<string | null>(null);
  const [reviewBusy, setReviewBusy] = useState<"accept" | "dismiss" | null>(null);
  const loadSeq = useRef(0);
  const activeThreadIdRef = useRef<string | null>(null);

  function rememberActiveThread(id: string | null) {
    activeThreadIdRef.current = id;
    setActiveThreadId(id);
  }

  const applyChatBody = useCallback((body: unknown, sliceWeekStart: string) => {
    if (typeof body !== "object" || body === null) {
      return;
    }
    if ("messages" in body) {
      const nextMessages = asMessages(body.messages);
      if (nextMessages !== null) {
        setMessages(nextMessages);
      }
    }
    if ("pendingProfileFreeze" in body) {
      setPendingProfileFreeze(asPendingProfileFreeze(body.pendingProfileFreeze));
    }
    if ("logs" in body) {
      const nextLogs = asLogs(body.logs);
      if (nextLogs !== null) {
        setLogs((current) => mergeWeekSlice(current, nextLogs, sliceWeekStart));
      }
    }
  }, []);

  const loadMonth = useCallback(
    async (nextStart: string, month: string) => {
      const seq = ++loadSeq.current;
      const grid = monthGridDates(month);
      const from = grid[0];
      const to = grid[grid.length - 1];
      const chart = loadChartWindow(utcToday());
      const extraChart = from !== chart.from || to !== chart.to;
      const threadId = activeThreadIdRef.current;
      const chatPath =
        threadId === null
          ? `/api/chat?weekStart=${nextStart}`
          : `/api/chat?weekStart=${nextStart}&threadId=${encodeURIComponent(threadId)}`;
      setCalendarError(undefined);
      setChatError(undefined);
      setWarnings([]);
      setHardViolations([]);
      setLoadedRange(null);
      setOptimisticMessages([]);
      setShowThinking(false);
      setBusy(true);
      try {
        const [planResponse, chartResponse, chatResponse, threadsResponse] = await Promise.all([
          fetch(`/api/plan?weekStart=${nextStart}&from=${from}&to=${to}`, { credentials: "same-origin" }),
          extraChart
            ? fetch(`/api/plan?weekStart=${nextStart}&from=${chart.from}&to=${chart.to}`, {
                credentials: "same-origin",
              })
            : Promise.resolve(null),
          fetch(chatPath, { credentials: "same-origin" }),
          fetch("/api/chat/threads", { credentials: "same-origin" }),
        ]);
        if (seq !== loadSeq.current) {
          return;
        }
        const planBody = await readBody(planResponse);
        if (seq !== loadSeq.current) {
          return;
        }
        if (!planResponse.ok) {
          const apiError = readError(planBody);
          setCalendarError(`${apiError.code}: ${apiError.message}`);
          return;
        }
        const chartBody = chartResponse === null ? null : await readBody(chartResponse);
        if (seq !== loadSeq.current) {
          return;
        }
        if (chartResponse !== null && !chartResponse.ok) {
          const apiError = readError(chartBody);
          setCalendarError(`${apiError.code}: ${apiError.message}`);
          return;
        }
        if (typeof planBody === "object" && planBody !== null && "weekStart" in planBody && "units" in planBody) {
          if (typeof planBody.weekStart === "string") {
            setWeekStart(planBody.weekStart);
          }
          let nextUnits = asUnits(planBody.units);
          if (nextUnits !== null && chartBody !== null && typeof chartBody === "object" && "units" in chartBody) {
            const chartUnits = asUnits(chartBody.units);
            if (chartUnits !== null) {
              nextUnits = mergeByDate(nextUnits, chartUnits);
            }
          }
          if (nextUnits !== null) {
            setUnits(nextUnits);
          }
          applyStack(planBody, setRevisions);
          setLatestSnapshotUnits(asLatestSnapshotUnits(planBody));
          let nextLogs = "logs" in planBody ? asLogs(planBody.logs) : null;
          if (nextLogs !== null && chartBody !== null && typeof chartBody === "object" && "logs" in chartBody) {
            const chartLogs = asLogs(chartBody.logs);
            if (chartLogs !== null) {
              nextLogs = mergeByDate(nextLogs, chartLogs);
            }
          }
          if (nextLogs !== null) {
            setLogs(nextLogs);
          }
        }
        const chatBody = await readBody(chatResponse);
        if (seq !== loadSeq.current) {
          return;
        }
        if (!chatResponse.ok) {
          const apiError = readError(chatBody);
          setChatError(`${apiError.code}: ${apiError.message}`);
          return;
        }
        applyChatBody(chatBody, nextStart);
        if (typeof chatBody === "object" && chatBody !== null && "threadId" in chatBody) {
          rememberActiveThread(typeof chatBody.threadId === "string" ? chatBody.threadId : null);
        }
        if (threadsResponse.ok) {
          const threadsBody = await readBody(threadsResponse);
          if (seq !== loadSeq.current) {
            return;
          }
          if (typeof threadsBody === "object" && threadsBody !== null && "threads" in threadsBody) {
            const nextThreads = asThreads(threadsBody.threads);
            if (nextThreads !== null) {
              setThreads(nextThreads);
            }
          }
        }
      } finally {
        if (seq === loadSeq.current) {
          setBusy(false);
        }
      }
    },
    [applyChatBody],
  );

  function goToMonth(nextMonth: string) {
    const nextStart = activeWeekStartForMonth(nextMonth, utcToday());
    setVisibleMonth(nextMonth);
    void loadMonth(nextStart, nextMonth);
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadMonth(initialWeekStart, utcMonthStart(utcToday()));
    }, 0);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [initialWeekStart, loadMonth]);

  async function saveSnapshot() {
    setCalendarError(undefined);
    setBusy(true);
    try {
      const response = await fetch("/api/plan/snapshots", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart }),
      });
      const body = await readBody(response);
      if (!response.ok) {
        const apiError = readError(body);
        setCalendarError(`${apiError.code}: ${apiError.message}`);
        return;
      }
      applyStack(body, setRevisions);
      setLatestSnapshotUnits(unitsInWeek(units, weekStart));
    } finally {
      setBusy(false);
    }
  }

  async function generateWeek() {
    setCalendarError(undefined);
    setHardViolations([]);
    setBusy(true);
    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart }),
      });
      const body = await readBody(response);
      if (!response.ok) {
        const apiError = readError(body);
        setCalendarError(`${apiError.code}: ${apiError.message}`);
        return;
      }
      const monday =
        typeof body === "object" && body !== null && "weekStart" in body && typeof body.weekStart === "string"
          ? body.weekStart
          : weekStart;
      setWeekStart(monday);
      if (typeof body === "object" && body !== null && "plan" in body) {
        const plan = body.plan;
        if (typeof plan === "object" && plan !== null && "units" in plan) {
          const nextUnits = asUnits(plan.units);
          if (nextUnits !== null) {
            setUnits((current) => mergeWeekSlice(current, nextUnits, monday));
          }
        }
      }
      if (typeof body === "object" && body !== null && "validation" in body) {
        setWarnings(asSoft(body.validation));
      }
      applyStack(body, setRevisions);
    } finally {
      setBusy(false);
    }
  }

  async function send(content: string) {
    const trimmed = content.trim();
    if (trimmed === "") {
      return;
    }
    setChatError(undefined);
    setLoadedRange(null);
    setOptimisticMessages((current) => [
      ...current,
      {
        id: `pending-${Date.now()}`,
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
        weekStart,
      },
    ]);
    setShowThinking(true);
    setBusy(true);
    try {
      const threadId = activeThreadIdRef.current;
      const response = await fetch("/api/chat/messages", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          threadId === null ? { weekStart, content: trimmed } : { weekStart, content: trimmed, threadId },
        ),
      });
      const body = await readBody(response);
      if (!response.ok) {
        const apiError = readError(body);
        setChatError(`${apiError.code}: ${apiError.message}`);
        setShowThinking(false);
        return;
      }
      applyChatBody(body, weekStart);
      setOptimisticMessages([]);
      setShowThinking(false);
      if (typeof body === "object" && body !== null && "threadId" in body && typeof body.threadId === "string") {
        rememberActiveThread(body.threadId);
      }
      if (typeof body === "object" && body !== null && "thread" in body) {
        const thread = asThread(body.thread);
        if (thread !== null) {
          setThreads((current) => {
            const rest = current.filter((item) => item.id !== thread.id);
            return [thread, ...rest].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
          });
        }
      }
      if (typeof body === "object" && body !== null && "loadedRange" in body) {
        setLoadedRange(asLoadedRange(body.loadedRange));
      }
      const validation =
        typeof body === "object" && body !== null && "validation" in body ? asValidation(body.validation) : null;
      if (validation !== null && validation.hard.length > 0) {
        setHardViolations(validation.hard);
        setWarnings([]);
        return;
      }
      setHardViolations([]);
      if (typeof body === "object" && body !== null && "units" in body) {
        const nextUnits = asUnits(body.units);
        if (nextUnits !== null) {
          setUnits((current) => mergeReturnedUnits(current, nextUnits, weekStart));
        }
      }
      if (typeof body === "object" && body !== null && "validation" in body) {
        setWarnings(asSoft(body.validation));
      }
      applyStack(body, setRevisions);
    } finally {
      setShowThinking(false);
      setBusy(false);
    }
  }

  async function newThread() {
    setChatError(undefined);
    setBusy(true);
    const seq = ++loadSeq.current;
    try {
      const response = await fetch("/api/chat/threads", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = await readBody(response);
      if (seq !== loadSeq.current) {
        return;
      }
      if (!response.ok) {
        const apiError = readError(body);
        setChatError(`${apiError.code}: ${apiError.message}`);
        return;
      }
      const thread = asThread(body);
      if (thread === null) {
        setChatError("UNKNOWN: Request failed");
        return;
      }
      rememberActiveThread(thread.id);
      setThreads((current) => [thread, ...current.filter((item) => item.id !== thread.id)]);
      setMessages([]);
      setOptimisticMessages([]);
      setShowThinking(false);
      setLoadedRange(null);
      setHardViolations([]);
    } finally {
      if (seq === loadSeq.current) {
        setBusy(false);
      }
    }
  }

  async function selectThread(threadId: string) {
    if (threadId === activeThreadIdRef.current) {
      return;
    }
    setChatError(undefined);
    setBusy(true);
    const seq = ++loadSeq.current;
    try {
      rememberActiveThread(threadId);
      const response = await fetch(`/api/chat?weekStart=${weekStart}&threadId=${encodeURIComponent(threadId)}`, {
        credentials: "same-origin",
      });
      const body = await readBody(response);
      if (seq !== loadSeq.current) {
        return;
      }
      if (!response.ok) {
        const apiError = readError(body);
        setChatError(`${apiError.code}: ${apiError.message}`);
        return;
      }
      applyChatBody(body, weekStart);
      setOptimisticMessages([]);
      setShowThinking(false);
      setLoadedRange(null);
    } finally {
      if (seq === loadSeq.current) {
        setBusy(false);
      }
    }
  }

  async function reportMessage(messageId: string) {
    if (reportingMessageId !== null) {
      return;
    }
    setChatError(undefined);
    setReportingMessageId(messageId);
    try {
      const response = await fetch("/api/chat/report", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart, messageId }),
      });
      const body = await readBody(response);
      if (!response.ok) {
        const apiError = readError(body);
        setChatError(`${apiError.code}: ${apiError.message}`);
        return;
      }
      setReportedMessageIds((current) => (current.includes(messageId) ? current : [...current, messageId]));
    } finally {
      setReportingMessageId(null);
    }
  }

  async function acceptPendingChanges() {
    setChatError(undefined);
    setReviewBusy("accept");
    try {
      const response = await fetch("/api/chat/accept", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart }),
      });
      const body = await readBody(response);
      if (!response.ok) {
        const apiError = readError(body);
        setChatError(`${apiError.code}: ${apiError.message}`);
        return;
      }
      setPendingProfileFreeze(null);
      if (typeof body === "object" && body !== null && "units" in body) {
        const nextUnits = asUnits(body.units);
        if (nextUnits !== null) {
          setUnits((current) => mergeReturnedUnits(current, nextUnits, weekStart));
        }
      }
      applyStack(body, setRevisions);
    } finally {
      setReviewBusy(null);
    }
  }

  async function dismissPendingChanges() {
    setChatError(undefined);
    setReviewBusy("dismiss");
    try {
      const response = await fetch("/api/chat/dismiss", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart }),
      });
      const body = await readBody(response);
      if (!response.ok) {
        const apiError = readError(body);
        setChatError(`${apiError.code}: ${apiError.message}`);
        return;
      }
      setPendingProfileFreeze(null);
    } finally {
      setReviewBusy(null);
    }
  }

  async function restore(revisionId: string) {
    setCalendarError(undefined);
    setBusy(true);
    try {
      const response = await fetch("/api/plan/restore", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart, revisionId }),
      });
      const body = await readBody(response);
      if (!response.ok) {
        const apiError = readError(body);
        setCalendarError(`${apiError.code}: ${apiError.message}`);
        return;
      }
      setLatestSnapshotUnits(unitsInWeek(units, weekStart));
      if (typeof body === "object" && body !== null && "units" in body) {
        const nextUnits = asUnits(body.units);
        if (nextUnits !== null) {
          setUnits((current) => mergeWeekSlice(current, nextUnits, weekStart));
        }
      }
      applyStack(body, setRevisions);
      setWarnings([]);
      setHardViolations([]);
    } finally {
      setBusy(false);
    }
  }

  async function saveUnit(payload: UnitEditPayload) {
    setCalendarError(undefined);
    setBusy(true);
    try {
      const response = await fetch("/api/plan/units", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await readBody(response);
      if (!response.ok) {
        const apiError = readError(body);
        setCalendarError(`${apiError.code}: ${apiError.message}`);
        return;
      }
      const actionMonday = utcMondayOf(payload.date);
      if (typeof body === "object" && body !== null && "units" in body) {
        const nextUnits = asUnits(body.units);
        if (nextUnits !== null) {
          setUnits((current) => mergeWeekSlice(current, nextUnits, actionMonday));
        } else {
          await loadMonth(weekStart, visibleMonth);
        }
      } else {
        const saved = asUnit(body);
        if (saved !== null) {
          setUnits((current) => mergeItemByDate(current, saved));
        } else if (typeof body === "object" && body !== null && "unit" in body) {
          const savedUnit = asUnit(body.unit);
          if (savedUnit !== null) {
            setUnits((current) => mergeItemByDate(current, savedUnit));
          } else {
            await loadMonth(weekStart, visibleMonth);
          }
        } else {
          await loadMonth(weekStart, visibleMonth);
        }
      }
      if (typeof body === "object" && body !== null && "validation" in body) {
        setWarnings(asWarnings(body.validation));
      }
      if (actionMonday === weekStart) {
        applyStack(body, setRevisions);
      }
    } finally {
      setBusy(false);
    }
  }

  async function deleteWorkout(date: string) {
    setCalendarError(undefined);
    setBusy(true);
    try {
      const response = await fetch(`/api/plan/units?date=${date}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const body = await readBody(response);
      if (!response.ok) {
        const apiError = readError(body);
        setCalendarError(`${apiError.code}: ${apiError.message}`);
        return;
      }
      const actionMonday = utcMondayOf(date);
      if (typeof body === "object" && body !== null && "units" in body) {
        const nextUnits = asUnits(body.units);
        if (nextUnits !== null) {
          setUnits((current) => mergeWeekSlice(current, nextUnits, actionMonday));
        } else {
          await loadMonth(weekStart, visibleMonth);
        }
      } else {
        await loadMonth(weekStart, visibleMonth);
      }
      if (typeof body === "object" && body !== null && "validation" in body) {
        setWarnings(asWarnings(body.validation));
      }
      if (actionMonday === weekStart) {
        applyStack(body, setRevisions);
      }
    } finally {
      setBusy(false);
    }
  }

  async function setFrozen(unit: TrainingUnit) {
    setCalendarError(undefined);
    setBusy(true);
    try {
      const response = await fetch("/api/plan/units", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: unit.date, frozen: !unit.frozen }),
      });
      const body = await readBody(response);
      if (!response.ok) {
        const apiError = readError(body);
        setCalendarError(`${apiError.code}: ${apiError.message}`);
        return;
      }
      const saved = asUnit(body);
      if (saved !== null) {
        setUnits((current) => mergeItemByDate(current, saved));
      } else {
        await loadMonth(weekStart, visibleMonth);
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveLog(date: string, distanceKm: number, avgPaceSecPerKm?: number, avgHr?: number) {
    setCalendarError(undefined);
    setBusy(true);
    try {
      const response = await fetch("/api/plan/logs", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, distanceKm, avgPaceSecPerKm, avgHr }),
      });
      const body = await readBody(response);
      if (!response.ok) {
        const apiError = readError(body);
        setCalendarError(`${apiError.code}: ${apiError.message}`);
        return;
      }
      if (typeof body === "object" && body !== null && "logs" in body) {
        const nextLogs = asLogs(body.logs);
        if (nextLogs !== null) {
          setLogs((current) => mergeWeekSlice(current, nextLogs, utcMondayOf(date)));
        } else {
          await loadMonth(weekStart, visibleMonth);
        }
      } else {
        await loadMonth(weekStart, visibleMonth);
      }
    } finally {
      setBusy(false);
    }
  }

  async function unlogDay(date: string) {
    setCalendarError(undefined);
    setBusy(true);
    try {
      const response = await fetch(`/api/plan/logs?date=${date}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const body = await readBody(response);
      if (!response.ok) {
        const apiError = readError(body);
        setCalendarError(`${apiError.code}: ${apiError.message}`);
        return;
      }
      if (typeof body === "object" && body !== null && "logs" in body) {
        const nextLogs = asLogs(body.logs);
        if (nextLogs !== null) {
          setLogs((current) => mergeWeekSlice(current, nextLogs, utcMondayOf(date)));
        } else {
          await loadMonth(weekStart, visibleMonth);
        }
      } else {
        await loadMonth(weekStart, visibleMonth);
      }
    } finally {
      setBusy(false);
    }
  }

  const weekUnits = unitsInWeek(units, weekStart);
  const snapshotDirty =
    weekUnits.length > 0 && (latestSnapshotUnits === null || !weekUnitsEqual(weekUnits, latestSnapshotUnits));

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="min-w-0 flex-1 overflow-hidden">
        <PlanCalendar
          weekStart={weekStart}
          visibleMonth={visibleMonth}
          units={units}
          races={races}
          logs={logs}
          error={calendarError}
          warnings={warnings}
          busy={busy}
          revisions={revisions}
          snapshotDirty={snapshotDirty}
          onPrevMonth={() => {
            goToMonth(addUtcMonths(visibleMonth, -1));
          }}
          onNextMonth={() => {
            goToMonth(addUtcMonths(visibleMonth, 1));
          }}
          onToday={() => {
            goToMonth(utcMonthStart(utcToday()));
          }}
          onGenerate={() => {
            const from = utcToday();
            const to = addUtcDays(from, 13);
            void send(generateHorizonPrompt(from, to, hasUnitInHorizon(units, from, to)));
          }}
          onGenerateWeek={() => {
            void generateWeek();
          }}
          onSaveSnapshot={() => {
            void saveSnapshot();
          }}
          onRestore={(revisionId) => {
            void restore(revisionId);
          }}
          onSaveUnit={(payload) => {
            void saveUnit(payload);
          }}
          onSaveLog={(date, distanceKm, avgPaceSecPerKm, avgHr) => {
            void saveLog(date, distanceKm, avgPaceSecPerKm, avgHr);
          }}
          onUnlog={(date) => {
            void unlogDay(date);
          }}
          onSetFrozen={(unit) => {
            void setFrozen(unit);
          }}
          onDeleteUnit={(date) => {
            void deleteWorkout(date);
          }}
        />
      </div>
      <div className="w-full min-w-0 shrink-0 lg:w-[420px] lg:max-w-[420px]">
        <PlanChat
          weekStart={weekStart}
          messages={messages}
          optimisticMessages={optimisticMessages}
          hardViolations={hardViolations}
          loadedRange={loadedRange}
          threads={threads}
          activeThreadId={activeThreadId}
          busy={busy}
          showThinking={showThinking}
          reportedMessageIds={reportedMessageIds}
          reportingMessageId={reportingMessageId}
          pendingProfileFreeze={pendingProfileFreeze}
          reviewBusy={reviewBusy}
          error={chatError}
          onSend={(content) => {
            void send(content);
          }}
          onNewThread={() => {
            void newThread();
          }}
          onSelectThread={(threadId) => {
            void selectThread(threadId);
          }}
          onReportMessage={(messageId) => {
            void reportMessage(messageId);
          }}
          onAcceptPending={() => {
            void acceptPendingChanges();
          }}
          onDismissPending={() => {
            void dismissPendingChanges();
          }}
        />
      </div>
    </div>
  );
}
