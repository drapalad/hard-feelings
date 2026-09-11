import { expect, test } from "@playwright/test";

// Seed exemplar for /10x-e2e. Generated specs copy these patterns:
// getByRole / getByLabel, unique data, wait-for-state, own cleanup.
// This file teaches the pattern (member race row survives reload). It is not
// a proof of test-plan risks #1–#6 — those stay on HTTP/Vitest. Later specs
// bind their names to a named UI risk.

function uniqueUpcomingDate(): string {
  const day = (Date.now() % 3650) + 1;
  return new Date(Date.UTC(2099, 0, day)).toISOString().slice(0, 10);
}

test("member-created race stays on the profile tab after reload", async ({ page }) => {
  const raceName = `E2E ${Date.now()}`;
  const raceDate = uniqueUpcomingDate();

  await page.goto("/dashboard?tab=profile");
  await expect(page.getByRole("heading", { name: "Race calendar" })).toBeVisible();

  await page.getByRole("button", { name: "Add race" }).click();
  await page.getByLabel("Date", { exact: true }).fill(raceDate);
  await page.getByLabel("Priority").selectOption("D");
  await page.getByLabel("Name (optional)").fill(raceName);
  await page.getByRole("button", { name: "Add race" }).click();

  const deleteRace = page.getByRole("button", { name: `Delete ${raceName}` });
  await expect(deleteRace).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Race calendar" })).toBeVisible();
  await expect(deleteRace).toBeVisible();

  await deleteRace.click();
  await expect(deleteRace).toHaveCount(0);
});
