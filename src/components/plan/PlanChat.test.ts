import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  formatLoadedChip,
  formatPendingCreateLine,
  formatPendingRaceAddLine,
  formatThreadFallback,
  shouldSubmitChatOnEnter,
} from "./PlanChat";

const source = readFileSync(path.join(import.meta.dirname, "PlanChat.tsx"), "utf8");
const HINT_COPY = /enter to send|press enter|↵ to send/i;

function keyEvent(overrides: { key?: string; shiftKey?: boolean; isComposing?: boolean } = {}) {
  return {
    key: overrides.key ?? "Enter",
    shiftKey: overrides.shiftKey ?? false,
    nativeEvent: { isComposing: overrides.isComposing ?? false },
  };
}

describe("shouldSubmitChatOnEnter", () => {
  it("submits on Enter without Shift", () => {
    expect(shouldSubmitChatOnEnter(keyEvent())).toBe(true);
  });

  it("does not submit on Shift+Enter", () => {
    expect(shouldSubmitChatOnEnter(keyEvent({ shiftKey: true }))).toBe(false);
  });

  it("does not submit while IME is composing", () => {
    expect(shouldSubmitChatOnEnter(keyEvent({ isComposing: true }))).toBe(false);
  });
});

describe("PlanChat layout and composer copy", () => {
  it("uses the locked heights, row composer, and requestSubmit", () => {
    expect(source).toContain("min-h-[32rem]");
    expect(source).toContain("min-h-[28rem]");
    expect(source).toContain("max-h-[40rem]");
    expect(source).not.toContain("max-h-72");
    expect(source).not.toContain("min-h-[24rem]");
    expect(source).toMatch(/<form className="flex items-end/);
    expect(source).toContain("flex-1 rounded-lg border border-white/20");
    expect(source).toContain("requestSubmit");
    expect(source).toContain('placeholder="Ask to change a day…"');
  });

  it("renders optimistic assistant loading state accessibly", () => {
    expect(source).toContain("optimisticMessages");
    expect(source).toContain("aria-busy={showThinking}");
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain("Coach is thinking");
    expect(source).toContain("const transcript = [...messages, ...optimisticMessages]");
  });

  it("keeps placeholder and JSX text free of keyboard-send hints", () => {
    const placeholder = /placeholder="([^"]*)"/.exec(source)?.[1] ?? "";
    expect(placeholder).toBe("Ask to change a day…");
    expect(placeholder).not.toMatch(HINT_COPY);

    const jsxText = [...source.matchAll(/>([^<>{]+)</g)].map((match) => match[1]).join("\n");
    expect(jsxText).not.toMatch(HINT_COPY);
  });

  it("uses the locked helper copy and does not gate the composer on empty units", () => {
    expect(source).toContain("The coach starts from your profile and current load.");
    expect(source).toContain("Ask what a day is for, or log a run.");
    expect(source).not.toContain("Ask the coach to lay out the next 10–14 days.");
    expect(source).not.toContain("Generate a plan for this week before chatting.");
    expect(source).not.toContain("Ask what a unit is for");
    expect(source).not.toContain("Replies can be model-written");
    expect(source).not.toContain("disabled={busy || unitsEmpty}");
    expect(source).not.toContain("unitsEmpty");
  });

  it("aligns user bubbles right and leaves assistant bubbles left", () => {
    const branches = /message\.role === "user"\s*\?\s*"([^"]+)"\s*:\s*"([^"]+)"/.exec(source);
    expect(branches).not.toBeNull();
    const userClasses = branches?.[1] ?? "";
    const assistantClasses = branches?.[2] ?? "";

    expect(userClasses).toContain("ml-auto");
    expect(userClasses).toContain("w-fit");
    expect(userClasses).toContain("max-w-[85%]");
    expect(userClasses).toContain("bg-purple-600/40");
    expect(userClasses).toContain("text-white");

    expect(assistantClasses).toContain("bg-white/10");
    expect(assistantClasses).toContain("text-blue-50");
    expect(assistantClasses).not.toContain("ml-auto");
    expect(assistantClasses).not.toContain("w-fit");
    expect(assistantClasses).not.toContain("max-w-[85%]");
  });
});

describe("PlanChat auto-apply chrome", () => {
  it("has no Proposed changes card and no Accept/Reject; hard violations use the red list class", () => {
    expect(source).not.toContain("Proposed changes");
    expect(source).not.toContain("onReject");
    expect(source).not.toContain(">Reject<");
    expect(source).toContain("text-red-200/90");
    expect(source).toContain("hardViolations");
  });

  it("shows a last-assistant flag control that flips to reported text", () => {
    expect(source).toContain("Flag for admin");
    expect(source).toContain("Reported to admin");
    expect(source).toContain("reportedMessageIds.includes(message.id)");
    expect(source).toContain("reportingMessageId !== null");
    expect(source).toContain("onReportMessage?.(message.id)");
  });

  it("renders the exact profile/freeze review card with Accept and Dismiss", () => {
    expect(source).toContain("Accept profile & freeze changes");
    expect(source).toContain("Accept new workouts");
    expect(source).toContain("Add workout:");
    expect(source).toContain("Add race:");
    expect(source).toContain("Accept\n            </Button>");
    expect(source).toContain("Dismiss\n            </Button>");
    expect(source).toContain("pendingProfileFreeze !== null");
    expect(source).toContain("onAcceptPending?.()");
    expect(source).toContain("onDismissPending?.()");
  });
});

describe("formatPendingCreateLine", () => {
  it("formats a create with day-month-year type and km", () => {
    expect(formatPendingCreateLine({ date: "2026-09-28", type: "base", distanceKm: 8 })).toBe(
      "Add workout: 28 Sep 2026 · base · 8 km",
    );
  });
});

describe("formatPendingRaceAddLine", () => {
  it("formats a named add with day-month-year", () => {
    expect(formatPendingRaceAddLine({ date: "2027-04-12", priority: "A", name: "Spring HM" })).toBe(
      "Add race: Spring HM · 12 Apr 2027 · A",
    );
  });
});

describe("formatLoadedChip", () => {
  it("formats a loaded date span and skips null", () => {
    expect(formatLoadedChip({ from: "2026-09-03", to: "2026-11-12" })).toBe("Loaded: 3 Sep–12 Nov");
    expect(formatLoadedChip({ from: "2026-12-28", to: "2027-01-03" })).toBe("Loaded: 28 Dec 2026–3 Jan 2027");
    expect(formatLoadedChip(null)).toBeNull();
  });
});

describe("PlanChat threads chrome", () => {
  it("shows a New thread control with Plus and a compact collapsible list", () => {
    expect(source).toContain('from "lucide-react"');
    expect(source).toContain("Plus");
    expect(source).toContain('aria-label="New thread"');
    expect(source).toContain("<details");
    expect(source).toContain("min-h-[32rem]");
    expect(source).toContain("min-h-[28rem]");
    expect(source).toContain("max-h-[40rem]");
    expect(source).toContain("No messages yet.");
    expect(source).not.toContain("No messages this week yet.");
    expect(source).toContain("Week of");
    expect(source).toContain('aria-current={active ? "true" : undefined}');
    expect(formatThreadFallback("2026-08-25T00:00:00.000Z")).toBe("Week of 25 Aug");
  });
});

describe("PlanChat loaded chip", () => {
  it("renders a muted chip from formatLoadedChip under the last assistant message", () => {
    expect(source).toContain("formatLoadedChip");
    expect(source).toContain("text-xs text-blue-100/50");
    expect(source).toContain("lastAssistantIndex");
    expect(source).not.toContain('from "@/lib/services/openai-chat"');
  });
});
