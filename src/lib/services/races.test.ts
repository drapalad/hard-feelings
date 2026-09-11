import { describe, expect, it } from "vitest";
import { mapUniqueViolation, sortRacesUpcomingFirst } from "./races";
import type { Race } from "@/types";

function race(partial: Partial<Race> & Pick<Race, "date" | "priority">): Race {
  return { id: "id", ...partial };
}

describe("sortRacesUpcomingFirst", () => {
  it("lists upcoming dates before past dates, each group ascending", () => {
    const sorted = sortRacesUpcomingFirst(
      [
        race({ id: "past-late", date: "2026-08-01", priority: "C" }),
        race({ id: "future", date: "2026-10-04", priority: "A" }),
        race({ id: "today", date: "2026-08-13", priority: "B" }),
        race({ id: "past-early", date: "2026-07-12", priority: "D" }),
        race({ id: "soon", date: "2026-08-16", priority: "B" }),
      ],
      "2026-08-13",
    );

    expect(sorted.map((item) => item.id)).toEqual(["today", "soon", "future", "past-early", "past-late"]);
  });
});

describe("mapUniqueViolation", () => {
  it("maps the one-A index to SECOND_A_RACE and the date constraint to DUPLICATE_RACE_DATE", () => {
    expect(mapUniqueViolation('duplicate key value violates unique constraint "races_one_a_per_user"')).toBe(
      "SECOND_A_RACE",
    );
    expect(mapUniqueViolation('duplicate key value violates unique constraint "races_user_id_date_key"')).toBe(
      "DUPLICATE_RACE_DATE",
    );
  });
});
