import { describe, expect, it } from "vitest";
import { formatLastRaceChip, seedRefDistance } from "./last-race";

describe("formatLastRaceChip", () => {
  it("matches the 10K 41:30 mock", () => {
    expect(formatLastRaceChip("2026-04-12", 10, 2490)).toBe("12 Apr 2026 · 10K · 41:30");
  });

  it("uses Half and Marathon labels", () => {
    expect(formatLastRaceChip("2026-04-12", 21.0975, 5400)).toBe("12 Apr 2026 · Half · 1:30:00");
    expect(formatLastRaceChip("2026-04-12", 42.195, 10800)).toBe("12 Apr 2026 · Marathon · 3:00:00");
  });

  it("formats custom km and trims trailing zeros", () => {
    expect(formatLastRaceChip("2026-01-05", 15, 3600)).toBe("5 Jan 2026 · 15 km · 1:00:00");
    expect(formatLastRaceChip("2026-01-05", 15.5, 3600)).toBe("5 Jan 2026 · 15.5 km · 1:00:00");
  });
});

describe("seedRefDistance", () => {
  it("maps 10 km to the 10K option", () => {
    expect(seedRefDistance(10)).toEqual({ label: "10K", customKm: "" });
  });

  it("maps unmatched km to Custom", () => {
    expect(seedRefDistance(15)).toEqual({ label: "Custom", customKm: "15" });
  });
});
