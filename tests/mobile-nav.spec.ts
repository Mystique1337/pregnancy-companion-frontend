import { test, expect } from "@playwright/test";
import { apiSignup } from "./helpers";

// TEST 6: Mobile bottom nav (390x844) after login exposes a Help/🆘 tab -> /sos.
test.use({ viewport: { width: 390, height: 844 } });

test("mobile bottom nav shows a Help/🆘 tab linking to /sos", async ({ page }) => {
  await apiSignup(page); // sets the session cookie on this context
  await page.goto("/dashboard");

  const bottomNav = page.locator("nav.bottom-nav");
  await expect(bottomNav).toBeVisible();

  // NOTE: for a free account the "Chat" tab ALSO routes to /sos (by design — the
  // voice channel is never a dead paywall), so two tabs share href="/sos".
  // The dedicated SOS/Help tab carries the `.sos` class.
  // The SOS tab renders icon 🆘 with label "Help" (t("nav.sos") = "Help") and href /sos.
  const sosTab = bottomNav.locator('a.bn-item.sos');
  await expect(sosTab).toBeVisible();
  await expect(sosTab).toContainText("🆘");
  await expect(sosTab).toContainText("Help");

  // Tapping it navigates to the SOS page.
  await sosTab.click();
  await expect(page).toHaveURL(/\/sos(\?|$)/);
  await expect(page.getByRole("heading", { name: "Am I okay?" })).toBeVisible();
});
