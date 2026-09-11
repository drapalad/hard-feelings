// risk: UI PROTECTED_ROUTES — a guest hitting /dashboard must not see the calendar
// (test-plan.md #6 is the JSON 401 on plan/chat/log APIs; this spec is the HTML gate)
// seed: tests/e2e/seed.spec.ts

import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("guest opening /dashboard is sent to sign-in", async ({ page }) => {
  await page.goto("/dashboard");
  await page.waitForURL(/\/auth\/signin/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Generate week" })).toHaveCount(0);
});
