// risk: Generate week must bind planned sessions onto the calendar UI
// (test-plan.md #3 volume oracle stays on Vitest; this is the rendered-week binding)
// seed: tests/e2e/seed.spec.ts

import { expect, test, type Page } from "@playwright/test";

function uniqueUpcomingDate(): string {
  const day = (Date.now() % 3650) + 1;
  return new Date(Date.UTC(2099, 0, day)).toISOString().slice(0, 10);
}

async function fillHydrated(page: Page, label: string, value: string, exact = false) {
  const field = page.getByLabel(label, exact ? { exact: true } : undefined);
  await expect(async () => {
    await field.click();
    await field.fill(value);
    await field.blur();
    await expect(field).toHaveValue(value);
  }).toPass();
}

test("generate week shows planned sessions on the calendar", async ({ page }) => {
  const raceName = `E2E A ${Date.now()}`;
  const raceDate = uniqueUpcomingDate();

  await page.goto("/dashboard?tab=profile");
  await expect(page.getByRole("heading", { name: "Weekly kilometres" })).toBeVisible();

  await fillHydrated(page, "Weekly km", "47.5");
  const savedKm = page.waitForResponse(
    (response) => response.url().includes("/api/profile") && response.request().method() === "PUT",
  );
  await page.getByRole("button", { name: "Save weekly km" }).click();
  const kmBody: unknown = await (await savedKm).json();
  expect(kmBody).toMatchObject({ weeklyKm: 47.5 });
  await expect(page.getByText("No weekly km set yet.")).toHaveCount(0);

  await page.getByRole("button", { name: "Add race" }).click();
  await fillHydrated(page, "Date", raceDate, true);
  await page.getByLabel("Priority").selectOption("A");
  await fillHydrated(page, "Name (optional)", raceName);
  await page.getByRole("button", { name: "Add race" }).click();
  const deleteRace = page.getByRole("button", { name: `Delete ${raceName}` });
  await expect(deleteRace).toBeVisible();

  await page.getByRole("link", { name: "Calendar" }).click();
  const generate = page.getByRole("button", { name: /^(Generate week|Regenerate week)$/ });
  await expect(generate).toBeVisible();

  const generated = page.waitForResponse(
    (response) => response.url().includes("/api/plan") && response.request().method() === "POST",
  );
  await generate.click();
  expect((await generated).ok()).toBeTruthy();

  await expect(page.getByText("No plan for this week yet.")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Regenerate week", exact: true })).toBeVisible();
  await expect(page.getByText("base", { exact: true }).first()).toBeVisible();

  await page.getByRole("link", { name: "Profile" }).click();
  await expect(deleteRace).toBeVisible();
  await deleteRace.click();
  await expect(deleteRace).toHaveCount(0);
});
