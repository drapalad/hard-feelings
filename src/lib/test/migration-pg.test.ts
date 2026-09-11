import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { FIXTURE_DATE, loadMigrationFiles, MEMBER_A_ID } from "./migration-safety";

const DEFAULT_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const OWNER_TABLES = [
  "profiles",
  "races",
  "training_units",
  "chat_messages",
  "chat_threads",
  "plan_revisions",
  "workout_logs",
  "user_roles",
] as const;

function adminConnectionString(): string {
  const url = process.env.HF_MIGRATION_PG_URL ?? DEFAULT_URL;
  const parsed = new URL(url);
  if (parsed.hostname.endsWith("supabase.co")) {
    throw new Error("hosted Supabase URLs are not allowed for this test");
  }
  return url;
}

async function stubAuth(client: Client, roleName: string): Promise<void> {
  await client.query("CREATE SCHEMA IF NOT EXISTS auth");
  await client.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
  await client.query("CREATE TABLE auth.users (id uuid PRIMARY KEY)");
  await client.query(`
    CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql
    STABLE
    AS $authuid$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $authuid$
  `);
  await client.query(`CREATE ROLE ${roleName} LOGIN PASSWORD 'hf_mig' NOSUPERUSER NOBYPASSRLS`);
  await client.query(`GRANT USAGE ON SCHEMA public TO ${roleName}`);
  await client.query(`GRANT USAGE ON SCHEMA auth TO ${roleName}`);
  await client.query(`GRANT EXECUTE ON FUNCTION auth.uid() TO ${roleName}`);
}

async function seedMemberA(client: Client): Promise<void> {
  await client.query("INSERT INTO auth.users (id) VALUES ($1)", [MEMBER_A_ID]);
  await client.query("INSERT INTO profiles (user_id, weekly_km) VALUES ($1, 42)", [MEMBER_A_ID]);
  await client.query(
    "INSERT INTO races (user_id, date, priority, name) VALUES ($1, '2026-10-04', 'A', 'member-a-a-race')",
    [MEMBER_A_ID],
  );
  await client.query(
    `INSERT INTO training_units (user_id, date, type, distance_km, structure, frozen)
     VALUES ($1, $2, 'long', 42, 'member-a-monday', false)`,
    [MEMBER_A_ID, FIXTURE_DATE],
  );
  await client.query(
    `INSERT INTO workout_logs (user_id, date, type, distance_km)
     VALUES ($1, $2, 'long', 42)`,
    [MEMBER_A_ID, FIXTURE_DATE],
  );
  await client.query(
    `INSERT INTO chat_threads (id, user_id, started_at, title, week_start)
     VALUES ('00000000-0000-4000-8000-0000000000aa', $1, timestamptz '2026-08-10 00:00:00+00', 'member-a-monday', $2)`,
    [MEMBER_A_ID, FIXTURE_DATE],
  );
  await client.query(
    `INSERT INTO chat_messages (user_id, week_start, role, content, thread_id)
     VALUES ($1, $2, 'user', 'member-a-monday', '00000000-0000-4000-8000-0000000000aa')`,
    [MEMBER_A_ID, FIXTURE_DATE],
  );
  await client.query(
    `INSERT INTO plan_revisions (user_id, week_start, units)
     VALUES ($1, $2, '[]'::jsonb)`,
    [MEMBER_A_ID, FIXTURE_DATE],
  );
  await client.query("INSERT INTO user_roles (user_id, role) VALUES ($1, 'admin')", [MEMBER_A_ID]);
}

async function forceOwnerRls(client: Client, roleName: string): Promise<void> {
  for (const table of OWNER_TABLES) {
    await client.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
  }
  await client.query(`GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${roleName}`);
}

describe.skipIf(process.env.HF_MIGRATION_PG !== "1")("local postgres migrate-over-fixture", () => {
  const dbName = `hf_mig_${String(Date.now())}`;
  const roleName = `${dbName}_member`;
  let admin: Client | undefined;
  let db: Client | undefined;
  let member: Client | undefined;
  let created = false;

  beforeAll(async () => {
    const { Client: PgClient } = await import("pg");
    const adminUrl = adminConnectionString();
    admin = new PgClient({ connectionString: adminUrl });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${dbName} TEMPLATE template0`);
    created = true;
    const dbUrl = new URL(adminUrl);
    dbUrl.pathname = `/${dbName}`;
    db = new PgClient({ connectionString: dbUrl.toString() });
    await db.connect();
    await db.query("SELECT 1");
    await stubAuth(db, roleName);
    const files = loadMigrationFiles();
    const newest = files.at(-1);
    if (newest === undefined) {
      throw new Error("expected supabase/migrations to contain at least one file");
    }
    for (const file of files.slice(0, -1)) {
      await db.query(file.sql);
    }
    await seedMemberA(db);
    await db.query(newest.sql);
    await forceOwnerRls(db, roleName);
    await db.query(`GRANT CONNECT ON DATABASE ${dbName} TO ${roleName}`);
    member = new PgClient({
      host: dbUrl.hostname,
      port: Number(dbUrl.port),
      user: roleName,
      password: "hf_mig",
      database: dbName,
    });
    await member.connect();
  });

  afterAll(async () => {
    if (member !== undefined) {
      await member.end();
    }
    if (db !== undefined) {
      await db.end();
    }
    if (admin !== undefined) {
      if (created) {
        try {
          await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
        } catch {
          /* best-effort cleanup */
        }
      }
      try {
        await admin.query(`DROP ROLE IF EXISTS ${roleName}`);
        await admin.query("DROP ROLE IF EXISTS hf_mig_member");
      } catch {
        /* best-effort cleanup */
      }
      await admin.end();
    }
  });

  it("creates a uniquely named local database and does not target hosted supabase", () => {
    expect(dbName.startsWith("hf_mig_")).toBe(true);
    const parsed = new URL(adminConnectionString());
    expect(["127.0.0.1", "localhost"]).toContain(parsed.hostname);
    expect(parsed.hostname.endsWith("supabase.co")).toBe(false);
  });

  it("returns distinctive Member A payloads via owner SELECT after the newest migration", async () => {
    if (member === undefined) {
      throw new Error("expected member postgres client");
    }
    await member.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [MEMBER_A_ID]);
    const units = await member.query<{
      user_id: string;
      date: Date | string;
      type: string;
      distance_km: string;
      structure: string;
    }>("SELECT user_id, date, type, distance_km, structure FROM training_units");
    expect(units.rows).toHaveLength(1);
    const unit = units.rows[0];
    expect(unit.user_id).toBe(MEMBER_A_ID);
    expect(unit.type).toBe("long");
    expect(unit.structure).toBe("member-a-monday");
    expect(Number(unit.distance_km)).toBe(42);
    const unitDate = unit.date instanceof Date ? unit.date.toISOString().slice(0, 10) : unit.date;
    expect(unitDate).toBe(FIXTURE_DATE);
    const logs = await member.query<{ user_id: string; distance_km: string }>(
      "SELECT user_id, distance_km FROM workout_logs",
    );
    expect(logs.rows).toHaveLength(1);
    const log = logs.rows[0];
    expect(log.user_id).toBe(MEMBER_A_ID);
    expect(Number(log.distance_km)).toBe(42);
    const profiles = await member.query<{ user_id: string; weekly_km: string }>(
      "SELECT user_id, weekly_km FROM profiles",
    );
    expect(profiles.rows).toHaveLength(1);
    const profile = profiles.rows[0];
    expect(profile.user_id).toBe(MEMBER_A_ID);
    expect(Number(profile.weekly_km)).toBe(42);
  });
});
