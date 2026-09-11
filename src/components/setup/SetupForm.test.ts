import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(path.join(import.meta.dirname, "SetupForm.tsx"), "utf8");

describe("SetupForm schedule and stimulus mix", () => {
  it("uses the locked headings, captions, and rest helper", () => {
    expect(source).toContain("Preferred long-run days");
    expect(source).toContain("Rest weekdays");
    expect(source).toContain("Stimulus mix");
    expect(source).toContain("Easy");
    expect(source).toContain("Threshold");
    expect(source).toContain("Speed");
    expect(source).toContain("Easy = base + recovery + long");
    expect(source).toContain("Threshold = tempo + threshold");
    expect(source).toContain("Speed = anaerobic, hills, strides — not gym");
    expect(source).toContain("None checked means every day is available.");
  });

  it("uses Mon–Sun checkbox values and no long_weekday select", () => {
    expect(source).toContain('type="checkbox"');
    expect(source).toContain("value={day}");
    for (const day of ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]) {
      expect(source).toContain(`"${day}"`);
    }
    expect(source).not.toMatch(/long_weekday/);
  });

  it("PUTs longWeekdays, restWeekdays, and mix fields together", () => {
    expect(source).toContain("longWeekdays:");
    expect(source).toContain("restWeekdays:");
    expect(source).toContain("mixEasy:");
    expect(source).toContain("mixThreshold:");
    expect(source).toContain("mixSpeed:");
    expect(source).toContain('method: "PUT"');
  });

  it("empty weekly km Save PUTs weeklyKm null and does not DELETE the profile", () => {
    expect(source).toContain('weeklyKm: trimmed === "" ? null : Number(trimmed)');
    expect(source).not.toMatch(/fetch\("\/api\/profile", \{\s*method: "DELETE"/);
    expect(source).toContain("No weekly km set yet");
  });

  it("does not add a load chart", () => {
    expect(source).not.toMatch(/recharts/i);
    expect(source).not.toContain("training-load");
    expect(source).not.toContain("load chart");
  });
});

describe("SetupForm last race persist", () => {
  it("PATCHes /api/profile for last-race Save and shows a Save label", () => {
    expect(source).toMatch(/fetch\("\/api\/profile", \{\s*method: "PATCH"/);
    expect(source).toContain("formatLastRaceChip");
    expect(source).toContain('{lastRaceBusy ? "Saving..." : "Save"}');
    expect(source).not.toContain("finish_time_sec");
  });
});

describe("SetupForm coach notes", () => {
  it("has a Coach notes textarea and PUTs coachNotes on Save", () => {
    expect(source).toContain("Coach notes");
    expect(source).toContain('id="coachNotes"');
    expect(source).toContain("saveCoachNotes");
    expect(source).toContain("coachNotes: notesInput");
    expect(source).toContain('method: "PUT"');
    expect(source).toMatch(/fetch\("\/api\/profile", \{\s*method: "PATCH"/);
  });

  it("empty weekly km still PUTs coachNotes with weeklyKm null", () => {
    expect(source).toContain('weeklyKm: trimmedKm === "" ? null : Number(trimmedKm)');
    expect(source).not.toContain("Save weekly km before saving coach notes");
    expect(source).toContain("coachNotes: notesInput");
  });
});
