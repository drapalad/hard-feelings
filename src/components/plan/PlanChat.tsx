import React, { useState } from "react";
import { Plus } from "lucide-react";
import { ServerError } from "@/components/auth/ServerError";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BoundViolation, ChatMessage, ChatThread, LoadedRange, PendingProfileFreeze } from "@/types";

export function formatLoadedChip(range: LoadedRange | null): string | null {
  if (range === null) {
    return null;
  }
  const includeYear = range.from.slice(0, 4) !== range.to.slice(0, 4);
  const from = formatLoadedDate(range.from, includeYear);
  const to = formatLoadedDate(range.to, includeYear);
  return `Loaded: ${from}–${to}`;
}

function formatLoadedDate(isoDate: string, includeYear: boolean): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const monthLabel = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][month - 1];
  return includeYear ? `${day} ${monthLabel} ${year}` : `${day} ${monthLabel}`;
}

export function formatPendingRaceAddLine(add: { date: string; priority: string; name?: string }): string {
  const name = add.name !== undefined && add.name.trim() !== "" ? add.name.trim() : "Unnamed";
  return `Add race: ${name} · ${formatLoadedDate(add.date, true)} · ${add.priority}`;
}

export function formatPendingRaceRemoveLine(id: string): string {
  return `Remove race: ${id}`;
}

export function formatPendingCreateLine(create: { date: string; type?: string; distanceKm?: number }): string {
  const type = create.type ?? "workout";
  const km = create.distanceKm !== undefined ? ` · ${create.distanceKm} km` : "";
  return `Add workout: ${formatLoadedDate(create.date, true)} · ${type}${km}`;
}

export function formatPendingRacePatchLine(patch: {
  id: string;
  date?: string;
  priority?: string;
  name?: string;
  goal?: string;
}): string {
  const parts = [`Patch race: ${patch.id}`];
  if (patch.date !== undefined) {
    parts.push(formatLoadedDate(patch.date, true));
  }
  if (patch.priority !== undefined) {
    parts.push(patch.priority);
  }
  if (patch.name !== undefined) {
    parts.push(patch.name);
  }
  if (patch.goal !== undefined) {
    parts.push(patch.goal);
  }
  return parts.join(" · ");
}

export function formatThreadFallback(startedAt: string): string {
  return `Week of ${formatLoadedDate(startedAt.slice(0, 10), false)}`;
}

export function formatThreadStarted(startedAt: string): string {
  return formatLoadedDate(startedAt.slice(0, 10), false);
}

interface PlanChatProps {
  weekStart: string;
  messages: ChatMessage[];
  optimisticMessages?: ChatMessage[];
  hardViolations: BoundViolation[];
  busy: boolean;
  showThinking?: boolean;
  reportedMessageIds?: string[];
  reportingMessageId?: string | null;
  pendingProfileFreeze?: PendingProfileFreeze | null;
  reviewBusy?: "accept" | "dismiss" | null;
  error?: string;
  loadedRange?: LoadedRange | null;
  threads?: ChatThread[];
  activeThreadId?: string | null;
  onSend: (content: string) => void;
  onNewThread?: () => void;
  onSelectThread?: (threadId: string) => void;
  onReportMessage?: (messageId: string) => void;
  onAcceptPending?: () => void;
  onDismissPending?: () => void;
}

export function shouldSubmitChatOnEnter(event: {
  key: string;
  shiftKey: boolean;
  nativeEvent: { isComposing: boolean };
}): boolean {
  if (event.nativeEvent.isComposing) {
    return false;
  }
  return event.key === "Enter" && !event.shiftKey;
}

export default function PlanChat({
  weekStart,
  messages,
  optimisticMessages = [],
  hardViolations,
  busy,
  showThinking = false,
  reportedMessageIds = [],
  reportingMessageId = null,
  pendingProfileFreeze = null,
  reviewBusy = null,
  error,
  loadedRange = null,
  threads = [],
  activeThreadId = null,
  onSend,
  onNewThread,
  onSelectThread,
  onReportMessage,
  onAcceptPending,
  onDismissPending,
}: PlanChatProps) {
  const [draft, setDraft] = useState("");
  const loadedChip = formatLoadedChip(loadedRange);
  const transcript = [...messages, ...optimisticMessages];
  const lastAssistantIndex = messages.findLastIndex((message) => message.role === "assistant");

  function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (content === "" || busy) {
      return;
    }
    onSend(content);
    setDraft("");
  }

  return (
    <section className="flex min-h-[32rem] flex-col space-y-4 text-left">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-white">Coach chat</h2>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="New thread"
          className="text-blue-100 hover:bg-white/10 hover:text-white"
          onClick={() => {
            onNewThread?.();
          }}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <details className="rounded-md border border-white/10 bg-white/5 text-sm text-blue-100/80">
        <summary className="cursor-pointer px-3 py-2 text-blue-50">Threads</summary>
        <ul className="max-h-40 space-y-1 overflow-y-auto px-2 pb-2">
          {threads.map((thread) => {
            const active = thread.id === activeThreadId;
            return (
              <li key={thread.id}>
                <button
                  type="button"
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex w-full items-baseline justify-between gap-2 rounded-md px-2 py-1.5 text-left",
                    active ? "bg-white/15 text-white" : "hover:bg-white/10",
                  )}
                  onClick={() => {
                    onSelectThread?.(thread.id);
                  }}
                >
                  <span className="truncate">{thread.title ?? formatThreadFallback(thread.startedAt)}</span>
                  <span className="shrink-0 text-xs text-blue-100/50">{formatThreadStarted(thread.startedAt)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </details>
      <p className="text-sm text-blue-100/70">The coach starts from your profile and current load.</p>
      <p className="text-sm text-blue-100/70">Ask what a day is for, or log a run.</p>

      <div
        aria-busy={showThinking}
        className="max-h-[40rem] min-h-[28rem] flex-1 space-y-2 overflow-y-auto rounded-lg border border-white/10 bg-white/5 p-3"
      >
        {transcript.length === 0 && !showThinking ? (
          <p className="text-sm text-blue-100/50">No messages yet.</p>
        ) : (
          transcript.map((message, index) => (
            <div key={message.id} className="space-y-1">
              <p
                className={cn(
                  "rounded-md px-3 py-2 text-sm",
                  message.role === "user"
                    ? "ml-auto w-fit max-w-[85%] bg-purple-600/40 text-white"
                    : "bg-white/10 text-blue-50",
                )}
              >
                {message.content}
              </p>
              {index === lastAssistantIndex && loadedChip !== null ? (
                <p className="text-xs text-blue-100/50">{loadedChip}</p>
              ) : null}
              {message.role === "assistant" && index === lastAssistantIndex ? (
                reportedMessageIds.includes(message.id) ? (
                  <p className="text-xs text-blue-100/50">Reported to admin</p>
                ) : (
                  <button
                    type="button"
                    disabled={reportingMessageId !== null}
                    className="text-xs text-blue-100/50 transition hover:text-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => {
                      onReportMessage?.(message.id);
                    }}
                  >
                    Flag for admin
                  </button>
                )
              ) : null}
            </div>
          ))
        )}
        {showThinking ? (
          <div aria-live="polite" className="space-y-1">
            <div className="w-fit rounded-md bg-white/10 px-3 py-2 text-sm text-blue-50">
              <span className="inline-flex items-center gap-2">
                <span>Coach is thinking</span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-100/70" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-100/70 [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-100/70 [animation-delay:300ms]" />
                </span>
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {hardViolations.length > 0 ? (
        <ul className="space-y-1 text-sm text-red-200/90">
          {hardViolations.map((violation) => (
            <li key={`${violation.code}-${violation.message}`}>{violation.message}</li>
          ))}
        </ul>
      ) : null}

      {pendingProfileFreeze !== null ? (
        <div className="space-y-3 rounded-lg border border-white/15 bg-white/5 p-4 text-sm text-blue-50">
          <h3 className="font-medium text-white">
            {pendingProfileFreeze.creates !== undefined &&
            pendingProfileFreeze.creates.length > 0 &&
            pendingProfileFreeze.profile === undefined &&
            pendingProfileFreeze.freeze.length === 0 &&
            pendingProfileFreeze.unfreeze.length === 0 &&
            pendingProfileFreeze.races === undefined
              ? "Accept new workouts"
              : "Accept profile & freeze changes"}
          </h3>
          {pendingProfileFreeze.profile?.weeklyKm !== undefined ? (
            <p>Weekly km: {pendingProfileFreeze.profile.weeklyKm}</p>
          ) : null}
          {pendingProfileFreeze.profile?.longWeekdays !== undefined ? (
            <p>Long weekdays: {pendingProfileFreeze.profile.longWeekdays.join(", ") || "none"}</p>
          ) : null}
          {pendingProfileFreeze.profile?.restWeekdays !== undefined ? (
            <p>Rest weekdays: {pendingProfileFreeze.profile.restWeekdays.join(", ") || "none"}</p>
          ) : null}
          {pendingProfileFreeze.profile?.mixEasy !== undefined ? (
            <p>
              Mix: {pendingProfileFreeze.profile.mixEasy}/{pendingProfileFreeze.profile.mixThreshold ?? 0}/
              {pendingProfileFreeze.profile.mixSpeed ?? 0}
            </p>
          ) : null}
          {pendingProfileFreeze.freeze.length > 0 ? <p>Freeze: {pendingProfileFreeze.freeze.join(", ")}</p> : null}
          {pendingProfileFreeze.unfreeze.length > 0 ? (
            <p>Unfreeze: {pendingProfileFreeze.unfreeze.join(", ")}</p>
          ) : null}
          {pendingProfileFreeze.races?.add.map((add, index) => (
            <p key={`add-${add.date}-${String(index)}`}>{formatPendingRaceAddLine(add)}</p>
          ))}
          {pendingProfileFreeze.races?.remove.map((item) => (
            <p key={`remove-${item.id}`}>{formatPendingRaceRemoveLine(item.id)}</p>
          ))}
          {pendingProfileFreeze.races?.patch.map((item) => (
            <p key={`patch-${item.id}`}>{formatPendingRacePatchLine(item)}</p>
          ))}
          {pendingProfileFreeze.creates?.map((item) => (
            <p key={`create-${item.date}`}>{formatPendingCreateLine(item)}</p>
          ))}
          <div className="flex gap-2">
            <Button
              type="button"
              disabled={reviewBusy !== null}
              className="rounded-lg bg-purple-600 text-white hover:bg-purple-500"
              onClick={() => {
                onAcceptPending?.();
              }}
            >
              Accept
            </Button>
            <Button
              type="button"
              disabled={reviewBusy !== null}
              variant="outline"
              className="rounded-lg border-white/20 bg-transparent text-blue-50 hover:bg-white/10"
              onClick={() => {
                onDismissPending?.();
              }}
            >
              Dismiss
            </Button>
          </div>
        </div>
      ) : null}

      <ServerError message={error} />

      <form className="flex items-end gap-2" onSubmit={submit}>
        <label className="sr-only" htmlFor={`chat-draft-${weekStart}`}>
          Message
        </label>
        <textarea
          id={`chat-draft-${weekStart}`}
          value={draft}
          disabled={busy}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onKeyDown={(event) => {
            if (!shouldSubmitChatOnEnter(event)) {
              return;
            }
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }}
          rows={3}
          className={cn(
            "flex-1 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-blue-100/40",
            "focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:outline-none",
          )}
          placeholder="Ask to change a day…"
        />
        <Button
          type="submit"
          disabled={busy || draft.trim() === ""}
          className="rounded-lg bg-purple-600 text-white hover:bg-purple-500"
        >
          Send
        </Button>
      </form>
    </section>
  );
}
