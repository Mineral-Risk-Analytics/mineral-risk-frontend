/**
 * Companies / regulations surfaces, link integrity, and mobile layout
 * (test plan P0 #7–11).
 */
import { test, expect } from "@playwright/test";
import { expectLoaded } from "./helpers";

test.describe("entity surfaces", () => {
  test("companies index and first profile load", async ({ page }) => {
    await page.goto("/intelligence/companies");
    await expectLoaded(page, ".ih-list-row");
    await page.locator(".ih-list-row").first().click();
    await expect(page.locator(".ih-entity-title")).toBeVisible();
  });

  test("regulations index and first profile load", async ({ page }) => {
    await page.goto("/intelligence/regulations");
    await expectLoaded(page, ".ih-list-row");
    await page.locator(".ih-list-row").first().click();
    await expect(page.locator(".ih-entity-title")).toBeVisible();
  });

  test("methodology page renders", async ({ page }) => {
    await page.goto("/intelligence/methodology");
    await expect(page.locator("h1").first()).toBeVisible();
  });
});

test.describe("link integrity", () => {
  test("every nav and footer link resolves", async ({ page, request }) => {
    await page.goto("/intelligence");
    const hrefs = await page.evaluate(() =>
      Array.from(
        document.querySelectorAll<HTMLAnchorElement>(
          ".ih-nav-links a, .ih-footer a",
        ),
      )
        .map((a) => a.getAttribute("href") ?? "")
        .filter((h) => h.startsWith("/")),
    );
    expect(hrefs.length).toBeGreaterThan(4);
    for (const href of Array.from(new Set(hrefs))) {
      const res = await request.get(href);
      expect(res.status(), `${href} returned ${res.status()}`).toBeLessThan(400);
    }
  });
});

test.describe("mobile layout", () => {
  test("feed and a profile render at 375px without horizontal scroll", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    for (const path of ["/intelligence", "/intelligence/materials/rare-earth-elements"]) {
      await page.goto(path);
      await expect(page.locator(".ih-skel")).toHaveCount(0);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${path} overflows horizontally by ${overflow}px`).toBeLessThanOrEqual(1);
    }
  });
});
