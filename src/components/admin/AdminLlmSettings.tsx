import React, { useState } from "react";
import { ServerError } from "@/components/auth/ServerError";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AdminLlmSettingsProps {
  openaiModel: string | null;
  resolvedModel: string;
  envFallback: string | null;
  coachNotes: string | null;
}

interface ApiErrorBody {
  code: string;
  message: string;
}

interface SettingsPayload {
  openaiModel: string | null;
  resolvedModel: string;
  envFallback: string | null;
  coachNotes?: string | null;
}

const SUGGESTIONS = ["gpt-4o-mini", "gpt-4o", "gpt-5.6-luna"] as const;

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

function isSettingsPayload(body: unknown): body is SettingsPayload {
  if (typeof body !== "object" || body === null) {
    return false;
  }
  if (!("resolvedModel" in body) || typeof body.resolvedModel !== "string") {
    return false;
  }
  const stored = "openaiModel" in body ? body.openaiModel : undefined;
  if (stored !== null && typeof stored !== "string") {
    return false;
  }
  const envFallback = "envFallback" in body ? body.envFallback : undefined;
  if (envFallback !== null && typeof envFallback !== "string") {
    return false;
  }
  if ("coachNotes" in body) {
    const notes = body.coachNotes;
    if (notes !== null && typeof notes !== "string") {
      return false;
    }
  }
  return true;
}

function sourceLabel(openaiModel: string | null, envFallback: string | null): string {
  if (openaiModel !== null && openaiModel !== "") {
    return "saved override";
  }
  if (envFallback !== null && envFallback !== "") {
    return "OPENAI_MODEL";
  }
  return "gpt-4o-mini default";
}

export default function AdminLlmSettings({
  openaiModel: initialModel,
  resolvedModel: initialResolved,
  envFallback: initialEnv,
  coachNotes: initialCoachNotes,
}: AdminLlmSettingsProps) {
  const [draft, setDraft] = useState(initialModel ?? "");
  const [notesDraft, setNotesDraft] = useState(initialCoachNotes ?? "");
  const [openaiModel, setOpenaiModel] = useState(initialModel);
  const [resolvedModel, setResolvedModel] = useState(initialResolved);
  const [envFallback, setEnvFallback] = useState(initialEnv);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function save() {
    if (busy) {
      return;
    }
    setBusy(true);
    setError(undefined);
    const trimmed = draft.trim();
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openaiModel: trimmed === "" ? null : trimmed,
          coachNotes: notesDraft.trim() === "" ? null : notesDraft,
        }),
      });
      const body = await readBody(response);
      if (!response.ok) {
        const apiError = readError(body);
        setError(`${apiError.code}: ${apiError.message}`);
        return;
      }
      if (!isSettingsPayload(body)) {
        setError("UNKNOWN: Request failed");
        return;
      }
      setOpenaiModel(body.openaiModel);
      setResolvedModel(body.resolvedModel);
      setEnvFallback(body.envFallback);
      setDraft(body.openaiModel ?? "");
      setNotesDraft(body.coachNotes ?? "");
    } catch {
      setError("UNKNOWN: Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 text-left">
      <ServerError message={error} />
      <p className="text-sm text-blue-100/70">
        Resolved: <span className="text-blue-50">{resolvedModel}</span> ({sourceLabel(openaiModel, envFallback)})
      </p>
      <div>
        <label htmlFor="openai-model" className="mb-1 block text-sm text-blue-100/80">
          OpenAI model
        </label>
        <input
          id="openai-model"
          list="openai-model-suggestions"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          placeholder="Leave blank to use env / gpt-4o-mini"
          className={cn(
            "w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white placeholder-white/40",
            "focus:ring-2 focus:ring-purple-400 focus:outline-none",
          )}
        />
        <datalist id="openai-model-suggestions">
          {SUGGESTIONS.map((model) => (
            <option key={model} value={model} />
          ))}
        </datalist>
      </div>
      <div>
        <label htmlFor="admin-coach-notes" className="mb-1 block text-sm text-blue-100/80">
          Coach notes (all members)
        </label>
        <textarea
          id="admin-coach-notes"
          value={notesDraft}
          maxLength={2000}
          rows={4}
          onChange={(event) => {
            setNotesDraft(event.target.value);
          }}
          placeholder="Guidance injected into every member coaching completion"
          className={cn(
            "min-h-[6rem] w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white placeholder-white/40",
            "focus:ring-2 focus:ring-purple-400 focus:outline-none",
          )}
        />
      </div>
      <Button
        type="button"
        disabled={busy}
        className="rounded-lg bg-purple-600 text-white hover:bg-purple-500"
        onClick={() => {
          void save();
        }}
      >
        Save model
      </Button>
    </section>
  );
}
