import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
export const PROJECT_SETTINGS_ID = "default";

export const openaiModelIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9._:-]+$/);

export function resolveOpenAiModel(stored: string | null | undefined, envModel: string | undefined): string {
  const storedId = typeof stored === "string" ? stored.trim() : "";
  if (storedId !== "") {
    return storedId;
  }
  if (typeof envModel === "string" && envModel !== "") {
    return envModel;
  }
  return DEFAULT_OPENAI_MODEL;
}

function storedTextFromRow(row: unknown, column: "openai_model" | "coach_notes"): string | null {
  if (typeof row !== "object" || row === null || !(column in row)) {
    return null;
  }
  const value = (row as Record<string, unknown>)[column];
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function storedModelFromRow(row: unknown): string | null {
  return storedTextFromRow(row, "openai_model");
}

function storedNotesFromRow(row: unknown): string | null {
  return storedTextFromRow(row, "coach_notes");
}

export async function getStoredOpenAiModel(client: SupabaseClient): Promise<string | null> {
  try {
    const { data, error } = await client
      .from("project_settings")
      .select("openai_model")
      .eq("id", PROJECT_SETTINGS_ID)
      .maybeSingle();
    if (error) {
      return null;
    }
    return storedModelFromRow(data);
  } catch {
    return null;
  }
}

export async function getStoredCoachNotes(client: SupabaseClient): Promise<string | null> {
  try {
    const { data, error } = await client
      .from("project_settings")
      .select("coach_notes")
      .eq("id", PROJECT_SETTINGS_ID)
      .maybeSingle();
    if (error) {
      return null;
    }
    return storedNotesFromRow(data);
  } catch {
    return null;
  }
}

export async function setStoredOpenAiModel(
  client: SupabaseClient,
  openaiModel: string | null,
  updatedBy: string,
): Promise<void> {
  const { error } = await client.from("project_settings").upsert(
    {
      id: PROJECT_SETTINGS_ID,
      openai_model: openaiModel,
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) {
    throw new Error(error.message);
  }
}

export async function setStoredCoachNotes(
  client: SupabaseClient,
  coachNotes: string | null,
  updatedBy: string,
): Promise<void> {
  const { error } = await client.from("project_settings").upsert(
    {
      id: PROJECT_SETTINGS_ID,
      coach_notes: coachNotes,
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) {
    throw new Error(error.message);
  }
}

export async function loadOpenAiModel(client: SupabaseClient, envModel: string | undefined): Promise<string> {
  return resolveOpenAiModel(await getStoredOpenAiModel(client), envModel);
}
