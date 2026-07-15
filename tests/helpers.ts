import { type Page, expect } from "@playwright/test";

// Sign up a brand-new mother through the real signup API. This sets the
// `bumply_session` cookie on the browser context, so subsequent page.goto()
// calls are authenticated — exactly what a logged-in mother experiences.
export async function apiSignup(page: Page): Promise<string> {
  const email = `pw+${Date.now()}${Math.floor(Math.random() * 1000)}@bumply.test`;
  const res = await page.request.post("/api/auth/signup", {
    data: {
      full_name: "PW Tester",
      email,
      password: "testpass1234", // 12 chars — meets the form's >= 8 min length
      current_week: 12,
      due_date: "2026-01-01",
      source: "website",
    },
  });
  expect(res.ok(), `signup should succeed (HTTP ${res.status()})`).toBeTruthy();
  return email;
}

// DEMO STUB: the app ships a no-payment /api/subscribe that flips the account to
// premium (see app/api/subscribe/route.ts). We use it to reach the premium
// ChatPanel, because free accounts see a paywall on /chat instead of the chat UI.
export async function makePremium(page: Page): Promise<void> {
  const res = await page.request.post("/api/subscribe", { data: { plan: "premium" } });
  expect(res.ok(), `subscribe should succeed (HTTP ${res.status()})`).toBeTruthy();
}
