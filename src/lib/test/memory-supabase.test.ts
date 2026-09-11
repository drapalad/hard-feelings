import { describe, expect, it } from "vitest";
import { createMemorySupabase, MEMORY_TABLES } from "./memory-supabase";

const DATE = "2026-08-10";
const USER_A = "user-a";
const USER_B = "user-b";
const MEMBER_TABLES = MEMORY_TABLES.filter((name) => name !== "project_settings");

const rowA = {
  user_id: USER_A,
  date: DATE,
  type: "long",
  distance_km: 42,
  structure: null,
  frozen: false,
};

const rowB = {
  user_id: USER_B,
  date: DATE,
  type: "base",
  distance_km: 5,
  structure: null,
  frozen: false,
};

describe("createMemorySupabase", () => {
  it("does not persist a plan_propositions table", () => {
    expect(MEMORY_TABLES).not.toContain("plan_propositions");
  });

  it("seeds the persist tables used by later phases", async () => {
    const client = createMemorySupabase({
      training_units: [rowA],
      workout_logs: [{ user_id: USER_A, date: DATE, type: "long", distance_km: 42 }],
      chat_messages: [{ user_id: USER_A, week_start: DATE, role: "assistant", content: "ok" }],
      chat_threads: [{ user_id: USER_A, title: "ok", started_at: "2026-08-10T00:00:00.000Z" }],
      agent_reports: [
        {
          source_user_id: USER_A,
          week_start: DATE,
          kind: "gap",
          status: "open",
          title: "Gap",
          body: "Body",
          bound_codes: [],
        },
      ],
      chat_profile_freeze_pending: [
        {
          user_id: USER_A,
          week_start: DATE,
          status: "pending",
          profile_patch: {},
          freeze_dates: [],
          unfreeze_dates: [],
        },
      ],
      profiles: [{ user_id: USER_A, weekly_km: 50 }],
      plan_revisions: [{ user_id: USER_A, week_start: DATE, units: [] }],
      races: [{ user_id: USER_A, date: "2026-10-04", priority: "A" }],
    });

    for (const table of MEMBER_TABLES) {
      const { data, error } = await client.from(table).select("*");
      expect(error).toBeNull();
      const ownerKey = table === "agent_reports" ? "source_user_id" : "user_id";
      expect(data).toEqual([expect.objectContaining({ [ownerKey]: USER_A })]);
    }
    const settings = await client.from("project_settings").select("*");
    expect(settings.error).toBeNull();
    expect(settings.data).toEqual([]);
  });

  it("upserts project_settings by id without a user_id", async () => {
    const client = createMemorySupabase();
    const written = await client
      .from("project_settings")
      .upsert({ id: "default", openai_model: "gpt-5.6-luna", updated_by: USER_A }, { onConflict: "id" });
    expect(written.error).toBeNull();
    const selected = await client.from("project_settings").select("*").eq("id", "default").maybeSingle();
    expect(selected.error).toBeNull();
    expect(selected.data).toEqual(expect.objectContaining({ id: "default", openai_model: "gpt-5.6-luna" }));
    expect(selected.data).not.toEqual(expect.objectContaining({ user_id: USER_A }));

    await client
      .from("project_settings")
      .upsert({ id: "default", openai_model: null, updated_by: USER_A }, { onConflict: "id" });
    const cleared = await client.from("project_settings").select("*").eq("id", "default").maybeSingle();
    expect(cleared.data).toEqual(expect.objectContaining({ openai_model: null }));
  });

  it("leaks other members' rows unless .eq(user_id) is applied", async () => {
    const client = createMemorySupabase({
      training_units: [rowA, rowB],
    });

    const unfiltered = await client.from("training_units").select("date, type, distance_km, structure, frozen");
    expect(unfiltered.error).toBeNull();
    expect(unfiltered.data).toEqual([
      expect.objectContaining({ user_id: USER_A, type: "long", distance_km: 42 }),
      expect.objectContaining({ user_id: USER_B, type: "base", distance_km: 5 }),
    ]);

    const asB = await client
      .from("training_units")
      .select("date, type, distance_km, structure, frozen")
      .eq("user_id", USER_B);
    expect(asB.error).toBeNull();
    expect(asB.data).toEqual([expect.objectContaining({ user_id: USER_B, type: "base", distance_km: 5 })]);
    expect(asB.data).not.toEqual(expect.arrayContaining([expect.objectContaining({ user_id: USER_A })]));
  });

  it("returns { data: null, error: null } for maybeSingle on 0 rows", async () => {
    const client = createMemorySupabase();
    const { data, error } = await client.from("profiles").select("weekly_km").eq("user_id", USER_B).maybeSingle();
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("returns [] from delete+select when no row matches", async () => {
    const client = createMemorySupabase({
      workout_logs: [{ user_id: USER_A, date: DATE, type: "long", distance_km: 42 }],
    });
    const { data, error } = await client
      .from("workout_logs")
      .delete()
      .eq("user_id", USER_B)
      .eq("date", DATE)
      .select("date");
    expect(error).toBeNull();
    expect(data).toEqual([]);
    const leftover = await client.from("workout_logs").select("*");
    expect(leftover.data).toEqual([expect.objectContaining({ user_id: USER_A })]);
  });

  it("implements the fluent terminals used by persist functions", async () => {
    const client = createMemorySupabase({
      training_units: [rowA, rowB],
      profiles: [{ user_id: USER_B, weekly_km: 50 }],
      chat_profile_freeze_pending: [
        {
          id: "pending-b",
          user_id: USER_B,
          week_start: DATE,
          profile_patch: {},
          freeze_dates: [],
          unfreeze_dates: [],
          status: "pending",
        },
      ],
    });

    const listed = await client
      .from("training_units")
      .select("date, type, distance_km, structure, frozen")
      .eq("user_id", USER_B)
      .in("date", [DATE, "2026-08-11"])
      .order("date");
    expect(listed.data).toEqual([expect.objectContaining({ user_id: USER_B })]);

    const frozen = await client
      .from("training_units")
      .update({ frozen: true })
      .eq("user_id", USER_B)
      .eq("date", DATE)
      .select("date, type, distance_km, structure, frozen")
      .maybeSingle();
    expect(frozen.data).toEqual(expect.objectContaining({ user_id: USER_B, frozen: true }));
    const aAfterFreeze = await client.from("training_units").select("*").eq("user_id", USER_A).maybeSingle();
    expect(aAfterFreeze.data).toEqual(expect.objectContaining({ frozen: false }));

    const upserted = await client.from("training_units").upsert(
      {
        user_id: USER_B,
        date: DATE,
        type: "tempo",
        distance_km: 8,
        structure: null,
        frozen: true,
      },
      { onConflict: "user_id,date" },
    );
    expect(upserted.error).toBeNull();
    const afterUpsert = await client.from("training_units").select("*").eq("user_id", USER_B).maybeSingle();
    expect(afterUpsert.data).toEqual(expect.objectContaining({ type: "tempo", distance_km: 8 }));
    const aAfterUpsert = await client.from("training_units").select("*").eq("user_id", USER_A).maybeSingle();
    expect(aAfterUpsert.data).toEqual(expect.objectContaining({ type: "long", distance_km: 42 }));

    const logsWrite = await client
      .from("workout_logs")
      .upsert({ user_id: USER_B, date: DATE, type: "tempo", distance_km: 8 }, { onConflict: "user_id,date" });
    expect(logsWrite.error).toBeNull();
    const logs = await client
      .from("workout_logs")
      .select("date, type, distance_km")
      .eq("user_id", USER_B)
      .in("date", [DATE])
      .order("date");
    expect(logs.data).toEqual([expect.objectContaining({ user_id: USER_B, type: "tempo" })]);

    const profile = await client.from("profiles").select("weekly_km").eq("user_id", USER_B).maybeSingle();
    expect(profile.data).toEqual(expect.objectContaining({ weekly_km: 50 }));

    const pending = await client
      .from("chat_profile_freeze_pending")
      .select("id, week_start, status")
      .eq("user_id", USER_B)
      .eq("week_start", DATE)
      .eq("status", "pending")
      .maybeSingle();
    expect(pending.data).toEqual(expect.objectContaining({ id: "pending-b", status: "pending" }));

    const status = await client
      .from("chat_profile_freeze_pending")
      .update({ status: "accepted" })
      .eq("id", "pending-b")
      .eq("user_id", USER_B);
    expect(status.error).toBeNull();

    const revision = await client.from("plan_revisions").insert({ user_id: USER_B, week_start: DATE, units: [] });
    expect(revision.error).toBeNull();
    const counted = await client
      .from("plan_revisions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", USER_B)
      .eq("week_start", DATE);
    expect(counted.error).toBeNull();
    expect(counted.count).toBe(1);

    const cleared = await client.from("plan_revisions").delete().eq("user_id", USER_B).eq("week_start", DATE);
    expect(cleared.error).toBeNull();
    const afterClear = await client.from("plan_revisions").select("*").eq("user_id", USER_B);
    expect(afterClear.data).toEqual([]);

    const report = await client.from("agent_reports").insert({
      source_user_id: USER_B,
      week_start: DATE,
      kind: "gap",
      status: "open",
      title: "Gap",
      body: "Body",
      bound_codes: [],
    });
    expect(report.error).toBeNull();
    const selectedReport = await client.from("agent_reports").select("*").eq("source_user_id", USER_B).maybeSingle();
    expect(selectedReport.data).toEqual(expect.objectContaining({ title: "Gap", kind: "gap" }));
  });

  it("round-trips chat_threads rows", async () => {
    const client = createMemorySupabase();
    const inserted = await client
      .from("chat_threads")
      .insert({ user_id: USER_A, title: null, started_at: "2026-08-10T00:00:00.000Z" })
      .select("id, title, started_at, user_id")
      .maybeSingle();
    expect(inserted.error).toBeNull();
    expect(inserted.data).toEqual(
      expect.objectContaining({ user_id: USER_A, title: null, started_at: "2026-08-10T00:00:00.000Z" }),
    );
    const listed = await client.from("chat_threads").select("*").eq("user_id", USER_A);
    expect(listed.data).toEqual([expect.objectContaining({ user_id: USER_A })]);
  });

  it("limit truncates ordered select results", async () => {
    const client = createMemorySupabase({
      plan_revisions: [
        { id: "old", user_id: USER_A, week_start: DATE, units: [], created_at: "2026-08-10T00:00:00.000Z" },
        { id: "new", user_id: USER_A, week_start: DATE, units: [], created_at: "2026-08-11T00:00:00.000Z" },
      ],
    });
    const { data, error } = await client
      .from("plan_revisions")
      .select("id")
      .eq("user_id", USER_A)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data).toEqual(expect.objectContaining({ id: "new" }));
  });
});
