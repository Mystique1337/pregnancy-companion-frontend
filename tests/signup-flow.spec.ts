import { test, expect } from "@playwright/test";
import { makePremium } from "./helpers";

const MIN_TAP = 44; // the chat mic/send targets are spec'd at 48px; assert >= 44.

// TEST 5: Real signup UI flow -> dashboard -> chat.
// The signup form lives on the home page at /#register (app/_components/RegisterForm.tsx).
// Redesigned form: language-first, then name/phone/week/email/password; optional
// fields (partner, due date, etc.) are collapsed. Required: name, email, password
// (>= 8), current week. Language defaults to "en" so labels render in English.
test("signup a new mother through the UI, land on /dashboard, then reach chat", async ({ page }) => {
  const email = `pw+${Date.now()}@bumply.test`;
  const name = "Uiflow Mum";

  await page.goto("/#register");
  const form = page.locator("#register");
  await expect(form.getByRole("heading", { name: "Join Bumply" })).toBeVisible();

  await form.getByPlaceholder("Amara", { exact: true }).fill(name);
  await form.getByPlaceholder("amara@email.com").fill(email);
  await form.getByPlaceholder("At least 8 characters").fill("testpass1234"); // 12 chars >= min 8
  // Selects in order: [0] language, [1] "how many weeks pregnant".
  await form.locator("select").nth(1).selectOption("12");

  await form.getByRole("button", { name: /Start/i }).click();

  // RegisterForm shows a success card, then redirects to /dashboard (~1.2s).
  await page.waitForURL(/\/dashboard(\?|$)/, { timeout: 20000 });
  await expect(page.getByRole("heading", { level: 1 })).toContainText(name);

  // --- /chat mic + send accessibility ---
  // Free accounts hit a paywall on /chat; use the app's demo subscribe stub to
  // reach the real ChatPanel (mic + send buttons).
  await makePremium(page);
  await page.goto("/chat");

  const mic = page.getByRole("button", { name: "Speak" }); // aria-label = t("chat.speak")
  const send = page.getByRole("button", { name: "Send" }); // aria-label = t("chat.send")

  await expect(mic).toBeVisible();
  await expect(send).toBeVisible();

  const micBox = await mic.boundingBox();
  const sendBox = await send.boundingBox();
  expect(micBox, "mic button bounding box").not.toBeNull();
  expect(sendBox, "send button bounding box").not.toBeNull();
  expect(micBox!.width, "mic width").toBeGreaterThanOrEqual(MIN_TAP);
  expect(micBox!.height, "mic height").toBeGreaterThanOrEqual(MIN_TAP);
  expect(sendBox!.width, "send width").toBeGreaterThanOrEqual(MIN_TAP);
  expect(sendBox!.height, "send height").toBeGreaterThanOrEqual(MIN_TAP);
});
