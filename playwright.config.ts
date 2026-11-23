/**
 * Playwright smoke suite config (2026-11-23).
 *
 * Read-only smoke tests against a DEPLOYED hub (Phase 1 of the test plan —
 * no local stack, no auth). Default target is the dev site; override with
 * E2E_BASE_URL (and E2E_API_URL for the API cross-checks).
 *
 * Timeouts are deliberately generous: the dev API sleeps on Railway's
 * low tier and a cold start adds 5–30s to the first request.
 */
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 30_000 },
  retries: 1,
  // Smoke suite is small — serial keeps the (cold-startable) dev API from
  // being hammered by parallel first-hits.
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "https://dev.mineralriskanalytics.com",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    navigationTimeout: 60_000,
    actionTimeout: 15_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
