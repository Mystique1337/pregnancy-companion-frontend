import { test, expect } from "@playwright/test";

// TEST 4: Auth guard — protected routes redirect to /login when logged out.
// A fresh Playwright context carries no session cookie, so these must bounce.
const PROTECTED = ["/dashboard", "/chat", "/vitals"];

test.describe("Auth guard: protected routes redirect to /login", () => {
  for (const path of PROTECTED) {
    test(`${path} redirects to /login when logged out`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login(\?|$)/);
      // The `next` param should preserve where the mother was headed.
      expect(page.url()).toContain(`next=${encodeURIComponent(path)}`);
      await expect(page.locator('input[type="password"]')).toBeVisible();
    });
  }
});
