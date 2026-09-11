import { expect, test as setup, type Page } from "@playwright/test";

const AUTH_FILE = "playwright/.auth/user.json";

function originOf(page: Page) {
  return new URL(page.url()).origin;
}

setup("authenticate", async ({ page }) => {
  const stamp = String(Date.now());
  const storedEmail = process.env.E2E_EMAIL?.trim();
  const storedPassword = process.env.E2E_PASSWORD?.trim();
  const hasStoredCreds =
    storedEmail !== undefined && storedEmail !== "" && storedPassword !== undefined && storedPassword !== "";
  const email = hasStoredCreds ? storedEmail : `e2e-${stamp}@example.com`;
  const password = hasStoredCreds ? storedPassword : `e2e-${stamp}Aa1`;

  // HTML forms carry Origin; Astro rejects cross-site POSTs without it.
  await page.goto(hasStoredCreds ? "/auth/signin" : "/auth/signup");
  const origin = originOf(page);

  if (!hasStoredCreds) {
    const signup = await page.request.post("/api/auth/signup", {
      form: { email, password, confirmPassword: password },
      headers: { Origin: origin, Referer: `${origin}/auth/signup` },
    });
    expect(signup.status(), signup.url()).toBeLessThan(400);
    expect(signup.url()).toContain("/auth/confirm-email");
  }

  const signin = await page.request.post("/api/auth/signin", {
    form: { email, password },
    headers: { Origin: origin, Referer: `${origin}/auth/signin` },
  });
  expect(signin.status(), signin.url()).toBeLessThan(400);
  expect(signin.url()).toMatch(/\/dashboard/);

  await page.goto("/dashboard");
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await page.context().storageState({ path: AUTH_FILE });
});
