import { defineConfig, devices } from "@playwright/test";

const PORT = 3210;

// Use the bundled Chromium in CI (self-contained, installed via
// `playwright install`), but the developer's installed Chrome locally.
const chromeUse = process.env.CI
  ? devices["Desktop Chrome"]
  : { ...devices["Desktop Chrome"], channel: "chrome" };

export default defineConfig({
  testDir: "./test",
  testMatch: "**/*.spec.pw.js",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`
  },
  projects: [
    {
      name: "chrome",
      use: chromeUse
    }
  ],
  webServer: {
    // Serve the whole repo root so tests can reach both the published demo
    // (docs/) and the unpublished exhaustive grammar fixture (test/fixtures/).
    command: `npx --yes serve@14 -l ${PORT} .`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000
  }
});
