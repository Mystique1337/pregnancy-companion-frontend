import { test, expect } from "@playwright/test";

// TEST 1: Public pages return 200 and render their expected content.
test.describe("Public pages: status + content", () => {
  test("/sos returns 200", async ({ page }) => {
    const res = await page.goto("/sos");
    expect(res?.status()).toBe(200);
  });

  test('/sos shows the heading "Am I okay?"', async ({ page }) => {
    await page.goto("/sos");
    await expect(page.getByRole("heading", { name: "Am I okay?" })).toBeVisible();
  });

  test('/sos has at least one "Read aloud" button', async ({ page }) => {
    await page.goto("/sos");
    const readAloud = page.getByRole("button", { name: /Read aloud/i });
    expect(await readAloud.count()).toBeGreaterThanOrEqual(1);
  });

  test("/immunization returns 200", async ({ page }) => {
    const res = await page.goto("/immunization");
    expect(res?.status()).toBe(200);
  });

  test('/immunization shows "Baby immunization schedule"', async ({ page }) => {
    await page.goto("/immunization");
    await expect(page.getByRole("heading", { name: "Baby immunization schedule" })).toBeVisible();
  });

  test('/immunization lists the "BCG" vaccine', async ({ page }) => {
    await page.goto("/immunization");
    await expect(page.getByText("BCG", { exact: true })).toBeVisible();
  });

  test("/login renders the sign-in form", async ({ page }) => {
    const res = await page.goto("/login");
    expect(res?.status()).toBe(200);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("/pricing renders (200)", async ({ page }) => {
    const res = await page.goto("/pricing");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("/forgot-password renders (200)", async ({ page }) => {
    const res = await page.goto("/forgot-password");
    expect(res?.status()).toBe(200);
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });
});
