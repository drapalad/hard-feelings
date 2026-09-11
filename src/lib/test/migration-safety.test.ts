import { describe, expect, it } from "vitest";
import { loadMigrationFiles, MEMBER_A_ID, migrateOverFixture } from "./migration-safety";

const files = loadMigrationFiles();
const newest = files.at(-1);
if (newest === undefined) {
  throw new Error("expected supabase/migrations to contain at least one file");
}

describe("risk #4 migration safety: migrate-over-fixture", () => {
  it("loads dated SQL files in filename order without a memory store", () => {
    expect(files.map((file) => file.name)).toEqual([
      "20260813104727_profiles_and_races.sql",
      "20260813130000_training_units.sql",
      "20260813160000_chat_gated_adaptation.sql",
      "20260814140000_plan_revisions.sql",
      "20260815160000_workout_logs.sql",
      "20260817120000_admin_algorithm_feedback.sql",
      "20260831194000_project_llm_settings.sql",
      "20260902140000_profile_plan_prefs.sql",
      "20260903123000_chat_profile_freeze_pending.sql",
      "20260903130000_chat_threads.sql",
      "20260903140000_log_pace_hr.sql",
      "20260904120000_profile_coach_notes.sql",
      "20260904120100_project_coach_notes.sql",
      "20260904121000_unit_stages.sql",
      "20260904180000_profile_last_race.sql",
      "20260904210000_chat_profile_freeze_pending_races_patch.sql",
      "20260905120000_profile_weekly_km_nullable.sql",
      "20260905160000_drop_plan_propositions.sql",
      "20260905200000_chat_profile_freeze_pending_calendar_creates.sql",
      "20260905210000_agent_reports_delete_admin.sql",
    ]);
  });

  it("keeps distinctive member payloads after each on-disk file following the first", () => {
    expect(files.length).toBeGreaterThan(1);
    for (let index = 1; index < files.length; index += 1) {
      const baseline = files.slice(0, index).map((file) => file.sql);
      const candidate = files[index];
      const result = migrateOverFixture(baseline, candidate.sql);
      expect(result.after).toEqual(result.before);
      expect(result.seededTables.length).toBeGreaterThan(0);
    }
  });

  it("keeps owner SELECT policies on member tables that existed before each later file", () => {
    for (let index = 1; index < files.length; index += 1) {
      const baseline = files.slice(0, index).map((file) => file.sql);
      const candidate = files[index];
      expect(() => migrateOverFixture(baseline, candidate.sql)).not.toThrow();
    }
  });

  it("fails the harness on DROP TABLE, unqualified DELETE, and DROP POLICY select-own", () => {
    const baseline = files.map((file) => file.sql);
    expect(() => migrateOverFixture(baseline, "DROP TABLE training_units;")).toThrow(/training_units/);
    expect(() => migrateOverFixture(baseline, "DELETE FROM training_units;")).toThrow(/training_units/);
    expect(() => migrateOverFixture(baseline, "DROP POLICY training_units_select_own ON training_units;")).toThrow(
      /training_units/,
    );
  });

  it("keeps distinctive profiles, training_units, and workout_logs after the newest on-disk file", () => {
    expect(newest.name).toBe("20260905210000_agent_reports_delete_admin.sql");
    const baseline = files.slice(0, -1).map((file) => file.sql);
    const result = migrateOverFixture(baseline, newest.sql);
    for (const table of ["profiles", "training_units", "workout_logs"] as const) {
      expect(result.seededTables).toContain(table);
      expect(result.after[table]).toEqual(result.before[table]);
    }
    expect(result.before.training_units[0]).toMatchObject({
      user_id: MEMBER_A_ID,
      distance_km: 42,
      structure: "member-a-monday",
    });
    expect(result.before.profiles[0]).toMatchObject({ user_id: MEMBER_A_ID, weekly_km: 42 });
    expect(result.before.workout_logs[0]).toMatchObject({ user_id: MEMBER_A_ID, distance_km: 42 });
  });
});
