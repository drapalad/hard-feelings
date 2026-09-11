import fs from "node:fs";
import path from "node:path";

export const OWNER_READABLE_TABLES = [
  "profiles",
  "races",
  "training_units",
  "chat_messages",
  "chat_threads",
  "plan_revisions",
  "workout_logs",
  "user_roles",
] as const;

export type OwnerReadableTable = (typeof OWNER_READABLE_TABLES)[number];

export const MEMBER_A_ID = "00000000-0000-4000-8000-00000000000a";
export const FIXTURE_DATE = "2026-08-10";

export type MemberRow = Record<string, string | number | boolean | null>;

export interface Policy {
  name: string;
  table: string;
  command: string;
  using: string;
}

export interface SchemaState {
  tables: Map<string, Set<string>>;
  policies: Policy[];
  rows: Map<string, MemberRow[]>;
}

export type PayloadSnapshot = Record<string, MemberRow[]>;

const DISTINCTIVE_SEEDS: Record<OwnerReadableTable, MemberRow> = {
  profiles: { user_id: MEMBER_A_ID, weekly_km: 42 },
  races: { user_id: MEMBER_A_ID, date: "2026-10-04", priority: "A", name: "member-a-a-race" },
  training_units: {
    user_id: MEMBER_A_ID,
    date: FIXTURE_DATE,
    type: "long",
    distance_km: 42,
    structure: "member-a-monday",
    frozen: false,
  },
  workout_logs: { user_id: MEMBER_A_ID, date: FIXTURE_DATE, type: "long", distance_km: 42 },
  chat_messages: {
    user_id: MEMBER_A_ID,
    week_start: FIXTURE_DATE,
    role: "user",
    content: "member-a-monday",
  },
  chat_threads: { user_id: MEMBER_A_ID },
  plan_revisions: { user_id: MEMBER_A_ID, week_start: FIXTURE_DATE, units: "[]" },
  user_roles: { user_id: MEMBER_A_ID, role: "admin" },
};

export function migrationsDir(): string {
  return path.resolve(import.meta.dirname, "../../../supabase/migrations");
}

export function loadMigrationFiles(dir: string = migrationsDir()): { name: string; sql: string }[] {
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort((left, right) => left.localeCompare(right))
    .map((name) => ({ name, sql: fs.readFileSync(path.join(dir, name), "utf8") }));
}

export function emptySchema(): SchemaState {
  return { tables: new Map(), policies: [], rows: new Map() };
}

export function isOwnerReadable(table: string): table is OwnerReadableTable {
  return (OWNER_READABLE_TABLES as readonly string[]).includes(table);
}

export function distinctiveSeed(table: OwnerReadableTable): MemberRow {
  return { ...DISTINCTIVE_SEEDS[table] };
}

export function snapshotDistinctive(state: SchemaState, tables: string[]): PayloadSnapshot {
  const snapshot: PayloadSnapshot = {};
  for (const table of tables) {
    if (!isOwnerReadable(table)) {
      continue;
    }
    const seed = DISTINCTIVE_SEEDS[table];
    const keys = Object.keys(seed);
    snapshot[table] = (state.rows.get(table) ?? []).map((row) => pick(row, keys));
  }
  return snapshot;
}

export function seedDistinctiveMembers(state: SchemaState): string[] {
  const seeded: string[] = [];
  for (const table of OWNER_READABLE_TABLES) {
    if (!state.tables.has(table)) {
      continue;
    }
    const rows = state.rows.get(table) ?? [];
    rows.push({ ...DISTINCTIVE_SEEDS[table] });
    state.rows.set(table, rows);
    seeded.push(table);
  }
  return seeded;
}

export function applySql(state: SchemaState, sql: string): void {
  for (const statement of splitStatements(sql)) {
    applyStatement(state, statement);
  }
}

export function migrateOverFixture(
  baselineSql: string[],
  candidateSql: string,
): { before: PayloadSnapshot; after: PayloadSnapshot; seededTables: string[] } {
  const state = emptySchema();
  for (const sql of baselineSql) {
    applySql(state, sql);
  }
  const seededTables = seedDistinctiveMembers(state);
  const before = snapshotDistinctive(state, seededTables);
  applySql(state, candidateSql);
  const after = snapshotDistinctive(state, seededTables);
  const lost = payloadDiff(before, after);
  if (lost !== null) {
    throw new Error(`member rows did not survive migration: ${lost}`);
  }
  const unreadable = missingSelectOwn(state, seededTables);
  if (unreadable !== null) {
    throw new Error(`owner SELECT policy missing after migration: ${unreadable}`);
  }
  return { before, after, seededTables };
}

function pick(row: MemberRow, keys: string[]): MemberRow {
  const next: MemberRow = {};
  for (const key of keys) {
    next[key] = row[key] ?? null;
  }
  return next;
}

function payloadDiff(before: PayloadSnapshot, after: PayloadSnapshot): string | null {
  for (const table of Object.keys(before)) {
    const expected = JSON.stringify(before[table]);
    const actual = JSON.stringify(after[table] ?? []);
    if (expected !== actual) {
      return `${table}: expected ${expected}, got ${actual}`;
    }
  }
  return null;
}

function missingSelectOwn(state: SchemaState, tables: string[]): string | null {
  for (const table of tables) {
    if (!isOwnerReadable(table)) {
      continue;
    }
    const ok = state.policies.some(
      (policy) =>
        policy.table === table &&
        (policy.command === "SELECT" || policy.command === "ALL") &&
        /auth\.uid\(\)\s*=\s*user_id/i.test(policy.using),
    );
    if (!ok) {
      return table;
    }
  }
  return null;
}

function bare(identifier: string): string {
  const trimmed = identifier.replaceAll('"', "");
  const dot = trimmed.lastIndexOf(".");
  return dot === -1 ? trimmed : trimmed.slice(dot + 1);
}

function splitStatements(sql: string): string[] {
  const stripped = stripComments(sql);
  const statements: string[] = [];
  let current = "";
  let inSingle = false;
  for (let i = 0; i < stripped.length; i += 1) {
    const ch = stripped[i] ?? "";
    if (ch === "'" && !inSingle) {
      inSingle = true;
      current += ch;
      continue;
    }
    if (ch === "'" && inSingle) {
      if (stripped[i + 1] === "'") {
        current += "''";
        i += 1;
        continue;
      }
      inSingle = false;
      current += ch;
      continue;
    }
    if (ch === ";" && !inSingle) {
      const stmt = current.trim();
      if (stmt !== "") {
        statements.push(stmt);
      }
      current = "";
      continue;
    }
    current += ch;
  }
  const tail = current.trim();
  if (tail !== "") {
    statements.push(tail);
  }
  return statements;
}

function stripComments(sql: string): string {
  let out = "";
  let i = 0;
  let inSingle = false;
  while (i < sql.length) {
    const ch = sql[i] ?? "";
    const next = sql[i + 1] ?? "";
    if (!inSingle && ch === "-" && next === "-") {
      while (i < sql.length && sql[i] !== "\n") {
        i += 1;
      }
      continue;
    }
    if (!inSingle && ch === "/" && next === "*") {
      i += 2;
      while (i < sql.length && !(sql[i] === "*" && sql[i + 1] === "/")) {
        i += 1;
      }
      i += 2;
      continue;
    }
    if (ch === "'" && !inSingle) {
      inSingle = true;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === "'" && inSingle) {
      if (next === "'") {
        out += "''";
        i += 2;
        continue;
      }
      inSingle = false;
      out += ch;
      i += 1;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

function applyStatement(state: SchemaState, statement: string): void {
  const collapsed = statement.replaceAll(/\s+/g, " ").trim();
  const createTable = parseCreateTable(collapsed);
  if (createTable !== null) {
    state.tables.set(createTable.table, new Set(createTable.columns));
    if (!state.rows.has(createTable.table)) {
      state.rows.set(createTable.table, []);
    }
    return;
  }
  const createPolicy = parseCreatePolicy(collapsed);
  if (createPolicy !== null) {
    state.policies.push(createPolicy);
    return;
  }
  const dropTable = match1(collapsed, /^DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?([a-zA-Z_][\w.]*)/i);
  if (dropTable !== null) {
    const table = bare(dropTable);
    state.tables.delete(table);
    state.rows.delete(table);
    state.policies = state.policies.filter((policy) => policy.table !== table);
    return;
  }
  const dropPolicy = exec2(collapsed, /^DROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?([a-zA-Z_][\w]*)\s+ON\s+([a-zA-Z_][\w.]*)/i);
  if (dropPolicy !== null) {
    const table = bare(dropPolicy[1]);
    state.policies = state.policies.filter((policy) => !(policy.name === dropPolicy[0] && policy.table === table));
    return;
  }
  const dropColumn = exec2(
    collapsed,
    /^ALTER\s+TABLE\s+([a-zA-Z_][\w.]*)\s+DROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?([a-zA-Z_][\w]*)/i,
  );
  if (dropColumn !== null) {
    const table = bare(dropColumn[0]);
    const column = dropColumn[1];
    state.tables.get(table)?.delete(column);
    const rows = state.rows.get(table) ?? [];
    state.rows.set(
      table,
      rows.map((row) => {
        const next: MemberRow = {};
        for (const [key, value] of Object.entries(row)) {
          if (key !== column) {
            next[key] = value;
          }
        }
        return next;
      }),
    );
    return;
  }
  const addColumn = exec2(collapsed, /^ALTER\s+TABLE\s+([a-zA-Z_][\w.]*)\s+ADD\s+COLUMN\s+([a-zA-Z_][\w]*)/i);
  if (addColumn !== null) {
    state.tables.get(bare(addColumn[0]))?.add(addColumn[1]);
    return;
  }
  const truncate = match1(collapsed, /^TRUNCATE\s+(?:TABLE\s+)?([a-zA-Z_][\w.]*)/i);
  if (truncate !== null) {
    state.rows.set(bare(truncate), []);
    return;
  }
  const deleteFrom = match1(collapsed, /^DELETE\s+FROM\s+([a-zA-Z_][\w.]*)/i);
  if (deleteFrom !== null) {
    state.rows.set(bare(deleteFrom), []);
    return;
  }
  const updateMatch = /^UPDATE\s+([a-zA-Z_][\w.]*)(?:\s+[a-zA-Z_][\w]*)?\s+SET\b/i.exec(collapsed);
  if (updateMatch !== null && typeof updateMatch[1] === "string") {
    const table = bare(updateMatch[1]);
    if (isOwnerReadable(table) && updateTouchesSeedKeys(table, collapsed)) {
      throw new Error(`UPDATE of owner-readable table ${table} would rewrite member rows`);
    }
    return;
  }
  const insert = match1(collapsed, /^INSERT\s+INTO\s+([a-zA-Z_][\w.]*)/i);
  if (insert !== null) {
    const table = bare(insert);
    if (isOwnerReadable(table) && (state.rows.get(table)?.length ?? 0) > 0) {
      throw new Error(`INSERT into owner-readable table ${table} would add member rows`);
    }
    return;
  }
  if (/^ALTER\s+TABLE\s+[a-zA-Z_][\w.]*\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY$/i.test(collapsed)) {
    return;
  }
  if (/^ALTER\s+TABLE\s+[a-zA-Z_][\w.]*\s+ALTER\s+COLUMN\b/i.test(collapsed)) {
    return;
  }
  if (/^ALTER\s+TABLE\s+[a-zA-Z_][\w.]*\s+ADD\s+CONSTRAINT\b/i.test(collapsed)) {
    return;
  }
  if (/^ALTER\s+TABLE\s+[a-zA-Z_][\w.]*\s+DROP\s+CONSTRAINT\b/i.test(collapsed)) {
    return;
  }
  if (/^CREATE\s+(?:UNIQUE\s+)?INDEX\b/i.test(collapsed)) {
    return;
  }
  if (/^COMMENT\s+ON\b/i.test(collapsed) || /^GRANT\b/i.test(collapsed)) {
    return;
  }
  throw new Error(`unclassified SQL statement: ${collapsed.slice(0, 180)}`);
}

function updateTouchesSeedKeys(table: OwnerReadableTable, statement: string): boolean {
  const seedKeys = new Set(Object.keys(DISTINCTIVE_SEEDS[table]));
  const setStart = statement.search(/\bSET\b/i);
  if (setStart === -1) {
    return true;
  }
  const afterSet = statement.slice(setStart + 3).trim();
  const until = afterSet.search(/\bFROM\b|\bWHERE\b/i);
  const setList = until === -1 ? afterSet : afterSet.slice(0, until);
  for (const part of splitTopLevel(setList, ",")) {
    const column = match1(part.trim(), /^([a-zA-Z_][\w]*)/);
    if (column !== null && seedKeys.has(column)) {
      return true;
    }
  }
  return false;
}

function match1(statement: string, pattern: RegExp): string | null {
  return pattern.exec(statement)?.[1] ?? null;
}

function exec2(statement: string, pattern: RegExp): [string, string] | null {
  const matched = pattern.exec(statement);
  if (matched === null) {
    return null;
  }
  const first = matched[1];
  const second = matched[2];
  if (typeof first !== "string" || typeof second !== "string") {
    return null;
  }
  return [first, second];
}

function parseCreateTable(statement: string): { table: string; columns: string[] } | null {
  const tableName = match1(statement, /^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z_][\w.]*)\s*\(/i);
  if (tableName === null) {
    return null;
  }
  const open = statement.indexOf("(");
  const body = parenContents(statement, open);
  const columns: string[] = [];
  for (const part of splitTopLevel(body, ",")) {
    const trimmed = part.trim();
    if (trimmed === "" || /^(CONSTRAINT|PRIMARY|UNIQUE|CHECK|FOREIGN)\b/i.test(trimmed)) {
      continue;
    }
    const col = match1(trimmed, /^([a-zA-Z_][\w]*)/);
    if (col !== null) {
      columns.push(col);
    }
  }
  return { table: bare(tableName), columns };
}

function parseCreatePolicy(statement: string): Policy | null {
  const matched =
    /^CREATE\s+POLICY\s+([a-zA-Z_][\w]*)\s+ON\s+([a-zA-Z_][\w.]*)\s+FOR\s+(SELECT|INSERT|UPDATE|DELETE|ALL)\b/i.exec(
      statement,
    );
  if (matched === null) {
    return null;
  }
  const name = matched[1];
  const table = matched[2];
  const command = matched[3];
  if (typeof name !== "string" || typeof table !== "string" || typeof command !== "string") {
    return null;
  }
  const usingIdx = statement.search(/\bUSING\s*\(/i);
  const using = usingIdx === -1 ? "" : parenContents(statement, statement.indexOf("(", usingIdx));
  return {
    name,
    table: bare(table),
    command: command.toUpperCase(),
    using,
  };
}

function parenContents(source: string, openIndex: number): string {
  let depth = 0;
  for (let i = openIndex; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "(") {
      depth += 1;
    } else if (ch === ")") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(openIndex + 1, i);
      }
    }
  }
  return source.slice(openIndex + 1);
}

function splitTopLevel(source: string, delimiter: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  for (const ch of source) {
    if (ch === "(") {
      depth += 1;
      current += ch;
      continue;
    }
    if (ch === ")") {
      depth -= 1;
      current += ch;
      continue;
    }
    if (ch === delimiter && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current !== "") {
    parts.push(current);
  }
  return parts;
}
