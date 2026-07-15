import { defineConfig, devices } from "@playwright/test";

// E2E UI / accessibility suite for Bumply.
// The app is started separately (see the task runbook):
//   set -a; source .env.local; set +a; PORT=3007 npm start
// and MUST be verified as Bumply (port 3000 is squatted by an unrelated app).
const BASE = process.env.PLAYWRIGHT_BASE || "http://localhost:3007";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: BASE,
    headless: true,
    trace: "off",
    // localhost is a secure context in Chromium, so the app's `Secure` session
    // cookie is still accepted over http://localhost — no HTTPS needed.
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
