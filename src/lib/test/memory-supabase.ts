import type { SupabaseClient } from "@supabase/supabase-js";

export const MEMORY_TABLES = [
  "training_units",
  "workout_logs",
  "chat_messages",
  "chat_threads",
  "agent_reports",
  "chat_profile_freeze_pending",
  "profiles",
  "plan_revisions",
  "races",
  "project_settings",
] as const;

export type MemoryTableName = (typeof MEMORY_TABLES)[number];

export type MemoryRow = Record<string, unknown>;

export type MemorySeed = Partial<Record<MemoryTableName, MemoryRow[]>>;

type Filter = { kind: "eq"; column: string; value: unknown } | { kind: "in"; column: string; values: unknown[] };

interface QueryState {
  op: "select" | "insert" | "update" | "upsert" | "delete";
  filters: Filter[];
  order: { column: string; ascending: boolean } | null;
  limit: number | null;
  payload: MemoryRow | MemoryRow[] | null;
  onConflict: string | null;
  head: boolean;
  countExact: boolean;
  maybeSingle: boolean;
  returning: boolean;
}

interface QueryResult {
  data: MemoryRow[] | MemoryRow | null;
  error: { message: string } | null;
  count: number | null;
}

function isMemoryTable(table: string): table is MemoryTableName {
  return (MEMORY_TABLES as readonly string[]).includes(table);
}

function emptyStore(): Record<MemoryTableName, MemoryRow[]> {
  return {
    training_units: [],
    workout_logs: [],
    chat_messages: [],
    chat_threads: [],
    agent_reports: [],
    chat_profile_freeze_pending: [],
    profiles: [],
    plan_revisions: [],
    races: [],
    project_settings: [],
  };
}

function matches(row: MemoryRow, filters: Filter[]): boolean {
  return filters.every((filter) => {
    if (filter.kind === "eq") {
      return row[filter.column] === filter.value;
    }
    return filter.values.includes(row[filter.column]);
  });
}

function asRowList(payload: MemoryRow | MemoryRow[]): MemoryRow[] {
  return Array.isArray(payload) ? payload : [payload];
}

function conflictColumns(onConflict: string): string[] {
  return onConflict
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "");
}

function sameConflict(left: MemoryRow, right: MemoryRow, columns: string[]): boolean {
  return columns.every((column) => left[column] === right[column]);
}

function sortableString(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return "";
}

function compareRows(left: MemoryRow, right: MemoryRow, order: { column: string; ascending: boolean }): number {
  const leftValue = sortableString(left[order.column]);
  const rightValue = sortableString(right[order.column]);
  if (leftValue === rightValue) {
    return 0;
  }
  if (leftValue < rightValue) {
    return order.ascending ? -1 : 1;
  }
  return order.ascending ? 1 : -1;
}

function stampRow(row: MemoryRow, seq: { n: number }): MemoryRow {
  const next: MemoryRow = { ...row };
  if (typeof next.id !== "string") {
    next.id = crypto.randomUUID();
  }
  if (typeof next.created_at !== "string") {
    seq.n += 1;
    next.created_at = new Date(1_700_000_000_000 + seq.n).toISOString();
  }
  return next;
}

function unknownResult(state: QueryState): QueryResult {
  if (state.maybeSingle || state.head) {
    return { data: null, error: null, count: state.countExact ? 0 : null };
  }
  if (state.op === "select" || state.returning) {
    return { data: [], error: null, count: state.countExact ? 0 : null };
  }
  return { data: null, error: null, count: null };
}

function finish(state: QueryState, resultRows: MemoryRow[]): QueryResult {
  const count = state.countExact ? resultRows.length : null;
  if (state.head) {
    return { data: null, error: null, count };
  }
  if (state.maybeSingle) {
    if (resultRows.length === 0) {
      return { data: null, error: null, count };
    }
    if (resultRows.length > 1) {
      return { data: null, error: { message: "Multiple rows returned" }, count };
    }
    return { data: structuredClone(resultRows[0]), error: null, count };
  }
  if (state.op !== "select" && !state.returning) {
    return { data: null, error: null, count };
  }
  return { data: structuredClone(resultRows), error: null, count };
}

function createBuilder(store: Record<MemoryTableName, MemoryRow[]>, table: string, seq: { n: number }) {
  const state: QueryState = {
    op: "select",
    filters: [],
    order: null,
    limit: null,
    payload: null,
    onConflict: null,
    head: false,
    countExact: false,
    maybeSingle: false,
    returning: false,
  };

  const builder = {
    select(_columns?: string, options?: { count?: "exact"; head?: boolean }) {
      if (state.op !== "select") {
        state.returning = true;
      }
      if (options?.count === "exact") {
        state.countExact = true;
      }
      if (options?.head === true) {
        state.head = true;
      }
      return builder;
    },
    eq(column: string, value: unknown) {
      state.filters.push({ kind: "eq", column, value });
      return builder;
    },
    in(column: string, values: unknown[]) {
      state.filters.push({ kind: "in", column, values });
      return builder;
    },
    order(column: string, options?: { ascending?: boolean }) {
      state.order = { column, ascending: options?.ascending !== false };
      return builder;
    },
    limit(count: number) {
      state.limit = count;
      return builder;
    },
    maybeSingle() {
      state.maybeSingle = true;
      return builder;
    },
    single() {
      state.maybeSingle = true;
      return builder;
    },
    insert(payload: MemoryRow | MemoryRow[]) {
      state.op = "insert";
      state.payload = payload;
      return builder;
    },
    update(payload: MemoryRow) {
      state.op = "update";
      state.payload = payload;
      return builder;
    },
    upsert(payload: MemoryRow | MemoryRow[], options?: { onConflict?: string }) {
      state.op = "upsert";
      state.payload = payload;
      state.onConflict = options?.onConflict ?? null;
      return builder;
    },
    delete() {
      state.op = "delete";
      return builder;
    },
    then<TResult1 = QueryResult, TResult2 = never>(
      onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): Promise<TResult1 | TResult2> {
      return Promise.resolve(execute()).then(onfulfilled, onrejected);
    },
  };

  function execute(): QueryResult {
    if (!isMemoryTable(table)) {
      return unknownResult(state);
    }
    const rows = store[table];
    if (state.op === "insert") {
      const inserted = asRowList(state.payload ?? []).map((row) => stampRow(row, seq));
      rows.push(...inserted);
      return finish(state, inserted);
    }
    if (state.op === "upsert") {
      const incoming = asRowList(state.payload ?? []);
      const keys = state.onConflict === null ? [] : conflictColumns(state.onConflict);
      const written: MemoryRow[] = [];
      for (const row of incoming) {
        const index = keys.length === 0 ? -1 : rows.findIndex((existing) => sameConflict(existing, row, keys));
        if (index === -1) {
          const stamped = stampRow(row, seq);
          rows.push(stamped);
          written.push(stamped);
          continue;
        }
        const merged = { ...rows[index], ...row };
        rows[index] = merged;
        written.push(merged);
      }
      return finish(state, written);
    }
    const matched = rows.filter((row) => matches(row, state.filters));
    if (state.op === "update") {
      const patch = state.payload !== null && !Array.isArray(state.payload) ? state.payload : {};
      for (const row of matched) {
        Object.assign(row, patch);
      }
      return finish(state, matched);
    }
    if (state.op === "delete") {
      const remaining = rows.filter((row) => !matches(row, state.filters));
      rows.length = 0;
      rows.push(...remaining);
      return finish(state, matched);
    }
    const orderBy = state.order;
    let selected = orderBy === null ? matched : [...matched].sort((left, right) => compareRows(left, right, orderBy));
    if (state.limit !== null) {
      selected = selected.slice(0, state.limit);
    }
    return finish(state, selected);
  }

  return builder;
}

export function createMemorySupabase(seed: MemorySeed = {}): SupabaseClient {
  const store = emptyStore();
  for (const name of MEMORY_TABLES) {
    const rows = seed[name];
    if (rows !== undefined) {
      store[name] = structuredClone(rows);
    }
  }
  const seq = { n: 0 };
  return {
    from(table: string) {
      return createBuilder(store, table, seq);
    },
  } as unknown as SupabaseClient;
}
