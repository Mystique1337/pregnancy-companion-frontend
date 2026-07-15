import { test, expect, type Locator } from "@playwright/test";

const MIN_A11Y = 40; // WCAG-ish minimum tap target used by the SOS danger rows.

// TEST 2: SOS accessibility of the red danger block and its per-row "Read aloud" buttons.
test.describe("SOS accessibility: danger block + read-aloud buttons", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/sos");
  });

  test("the red danger block ('Go to hospital NOW') exists", async ({ page }) => {
    await expect(page.getByText(/Go to hospital NOW if you have any of these/i)).toBeVisible();
  });

  test('every danger-sign row has a 🔊 button whose aria-label starts with "Read aloud"', async ({ page }) => {
    // Per-row speaker buttons are labelled `Read aloud: <sign>`.
    const rowButtons = page.getByRole("button", { name: /^Read aloud:/ });
    const count = await rowButtons.count();
    expect(count, "expected one read-aloud button per danger sign").toBeGreaterThanOrEqual(8);

    for (let i = 0; i < count; i++) {
      const label = await rowButtons.nth(i).getAttribute("aria-label");
      expect(label, `button ${i} aria-label`).toMatch(/^Read aloud/);
      await expect(rowButtons.nth(i)).toContainText("🔊");
    }
  });

  test("each danger-row read-aloud button is at least 40px tall", async ({ page }) => {
    const rowButtons = page.getByRole("button", { name: /^Read aloud:/ });
    const count = await rowButtons.count();
    expect(count).toBeGreaterThanOrEqual(8);

    for (let i = 0; i < count; i++) {
      const box = await rowButtons.nth(i).boundingBox();
      expect(box, `button ${i} should have a bounding box`).not.toBeNull();
      expect(box!.height, `danger row button ${i} height`).toBeGreaterThanOrEqual(MIN_A11Y);
    }
  });
});

// TEST 3: Tap-target audit — every visible <button> on /sos must be >= 40x40.
// A failure here is a genuine a11y finding, not a flaky test.
test("SOS tap-target audit: all visible buttons are >= 40x40px", async ({ page }) => {
  await page.goto("/sos");
  await expect(page.getByRole("heading", { name: "Am I okay?" })).toBeVisible();

  const buttons: Locator = page.locator("button");
  const total = await buttons.count();
  const failures: string[] = [];
  let audited = 0;

  for (let i = 0; i < total; i++) {
    const btn = buttons.nth(i);
    if (!(await btn.isVisible())) continue;
    audited++;
    const box = await btn.boundingBox();
    const text = ((await btn.textContent()) || "").trim().slice(0, 30);
    const label = (await btn.getAttribute("aria-label")) || "";
    const id = `[${label || text || "(unlabeled)"}]`;
    if (!box) {
      failures.push(`${id} has no bounding box`);
      continue;
    }
    if (box.width < 40 || box.height < 40) {
      failures.push(`${id} is ${Math.round(box.width)}x${Math.round(box.height)}px (< 40x40)`);
    }
  }

  console.log(`SOS tap-target audit: ${audited} visible buttons checked.`);
  expect(audited, "should have audited at least one button").toBeGreaterThan(0);
  expect(failures, `tap targets below 40x40:\n${failures.join("\n")}`).toEqual([]);
});
