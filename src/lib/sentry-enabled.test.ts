import { describe, expect, it } from "vitest";
import { isSentryIngestEnabled, resolveSentryDsn } from "./sentry-enabled";

describe("isSentryIngestEnabled", () => {
  it("stays on when the flag is unset or blank so production DSN-only keeps ingest", () => {
    expect(isSentryIngestEnabled(undefined)).toBe(true);
    expect(isSentryIngestEnabled("")).toBe(true);
    expect(isSentryIngestEnabled("   ")).toBe(true);
  });

  it("turns off on explicit false/0/off/no", () => {
    expect(isSentryIngestEnabled("false")).toBe(false);
    expect(isSentryIngestEnabled("FALSE")).toBe(false);
    expect(isSentryIngestEnabled("0")).toBe(false);
    expect(isSentryIngestEnabled("off")).toBe(false);
    expect(isSentryIngestEnabled("no")).toBe(false);
  });

  it("stays on for true/1/on/yes", () => {
    expect(isSentryIngestEnabled("true")).toBe(true);
    expect(isSentryIngestEnabled("1")).toBe(true);
    expect(isSentryIngestEnabled("on")).toBe(true);
    expect(isSentryIngestEnabled("yes")).toBe(true);
  });
});

describe("resolveSentryDsn", () => {
  it("returns a trimmed DSN when ingest is on", () => {
    expect(resolveSentryDsn({ SENTRY_DSN: " https://n@o.ingest.sentry.io/1 " })).toBe("https://n@o.ingest.sentry.io/1");
  });

  it("returns undefined when ingest is off even if a DSN is present", () => {
    expect(resolveSentryDsn({ SENTRY_DSN: "https://n@o.ingest.sentry.io/1", SENTRY_ENABLED: "false" })).toBeUndefined();
  });

  it("returns undefined when the DSN is missing or empty", () => {
    expect(resolveSentryDsn({})).toBeUndefined();
    expect(resolveSentryDsn({ SENTRY_DSN: "" })).toBeUndefined();
  });
});
