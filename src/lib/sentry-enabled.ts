const EXPLICIT_OFF = new Set(["false", "0", "off", "no"]);

/**
 * Worker ingest is on when a DSN is set, unless `SENTRY_ENABLED` is an explicit
 * off (`false` / `0` / `off` / `no`). Unset or empty keeps production ingest
 * working without a new secret. Local and later pre-prod set `SENTRY_ENABLED=false`.
 */
export function isSentryIngestEnabled(enabledFlag: string | undefined): boolean {
  if (enabledFlag === undefined) {
    return true;
  }
  const normalized = enabledFlag.trim().toLowerCase();
  if (normalized === "") {
    return true;
  }
  return !EXPLICIT_OFF.has(normalized);
}

export function resolveSentryDsn(env: { SENTRY_DSN?: string; SENTRY_ENABLED?: string }): string | undefined {
  if (!isSentryIngestEnabled(env.SENTRY_ENABLED)) {
    return undefined;
  }
  const dsn = env.SENTRY_DSN?.trim();
  return dsn !== undefined && dsn.length > 0 ? dsn : undefined;
}
