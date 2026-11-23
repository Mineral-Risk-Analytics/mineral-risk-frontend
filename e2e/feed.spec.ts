/**
 * Hub feed smoke — the landing surface (test plan P0 #1–3, #12).
 */
import { test, expect } from "@playwright/test";
import { API_BASE, expectLoaded } from "./helpers";

test.describe("intelligence feed", () => {
  test("feed loads with posts, no error, no stuck skeletons", async ({ page }) => {
    await page.goto("/intelligence");
    await expectLoaded(page, ".ih-recent-list a");
    expect(await page.locator(".ih-recent-list a").count()).toBeGreaterThan(0);
  });

  test("every visible tab has content behind it (empty tabs are hidden)", async ({
    page,
  }) => {
    await page.goto("/intelligence");
    await expectLoaded(page, ".ih-recent-list a");
    const tabs = page.locator(".ih-tab");
    const labels = await tabs.allTextContents();
    expect(labels).toContain("All"); // sanity: tab row rendered
    for (const label of labels.filter((l) => l !== "All")) {
      await page.locator(".ih-tab", { hasText: label }).click();
      // A visible tab must render SOMETHING: feed rows, a featured
      // report, or live signal rows. "No posts yet" on a visible tab
      // means the hide-empty-tabs contract broke.
      await expect
        .poll(async () => {
          const rows = await page.locator(".ih-recent-list a").count();
          const signals = await page.locator(".ih-signal-row").count();
          const featured = await page.locator(".ih-featured").count();
          return rows + signals + featured;
        })
        .toBeGreaterThan(0);
      await expect(page.getByText("posts yet — check back soon")).toHaveCount(0);
    }
  });

  test("signal tab matches the API and never leaks excluded sources", async ({
    page,
    request,
  }) => {
    await page.goto("/intelligence");
    await expectLoaded(page, ".ih-recent-list a");
    const signalTab = page.locator(".ih-tab", { hasText: "Signal" });
    const api = await request.get(`${API_BASE}/api/v1/intelligence/events?limit=15`);
    expect(api.ok()).toBeTruthy();
    const feed = await api.json();
    if ((await signalTab.count()) === 0) {
      // Tab hidden ⇒ the API must also say there are no events.
      expect(feed.total).toBe(0);
      return;
    }
    await signalTab.click();
    await expect(page.locator(".ih-signal-row").first()).toBeVisible();
    // Deploy-staleness canary: rendered rows == what the API serves.
    await expect(page.locator(".ih-signal-row")).toHaveCount(feed.data.length);
    await expect(page.getByText("OpenSanctions")).toHaveCount(0);
    // Signal rows carry plain-English direction chips, never raw jargon.
    await expect(page.getByText("display_only")).toHaveCount(0);
  });

  test("subscribe box accepts input (submission stays manual — no list pollution)", async ({
    page,
  }) => {
    await page.goto("/intelligence");
    const input = page.locator('input[type="email"]').first();
    await input.fill("smoke-test@example.com");
    await expect(input).toHaveValue("smoke-test@example.com");
  });
});
