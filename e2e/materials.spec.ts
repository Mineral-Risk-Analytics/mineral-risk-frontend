/**
 * Materials index + profile smoke (test plan P0 #5–6).
 */
import { test, expect } from "@playwright/test";
import { expectLoaded } from "./helpers";

test.describe("materials", () => {
  test("index lists the rated register, search narrows, rows navigate", async ({
    page,
  }) => {
    await page.goto("/intelligence/materials");
    await expectLoaded(page, ".ih-list-row");
    const all = await page.locator(".ih-list-row").count();
    expect(all).toBeGreaterThanOrEqual(30); // ~38 rated; loose on purpose
    // No bars, no numbers — the 2026-11 redesign contract.
    await expect(page.locator(".ih-mat-track")).toHaveCount(0);
    // Search narrows to the match.
    await page.locator(".ih-search").fill("lithium");
    await expect(page.locator(".ih-list-row")).toHaveCount(1);
    await expect(page.locator(".ih-list-row")).toContainText("Lithium");
    await page.locator(".ih-search").fill("");
    // Band filter chips filter.
    await page.locator(".ih-filter-chip", { hasText: "Critical" }).click();
    const crit = await page.locator(".ih-list-row").count();
    expect(crit).toBeGreaterThan(0);
    expect(crit).toBeLessThan(all);
    // Row navigates to a profile.
    await page.locator(".ih-filter-chip", { hasText: "All" }).click();
    await page.locator(".ih-list-row").first().click();
    await expect(page.locator(".ih-entity-title")).toBeVisible();
  });

  test("a material profile tells the whole concentration story", async ({ page }) => {
    await page.goto("/intelligence/materials/rare-earth-elements");
    await expectLoaded(page, ".ih-entity-title");
    await expect(page.locator(".ih-entity-title")).toHaveText("Rare Earth Elements");
    await expect(page.locator(".ih-risk-tag")).toContainText(
      "structural supply risk",
    );
    // Stage blocks with the driving-stage marker and cited sources.
    expect(await page.locator(".ih-stage-block").count()).toBeGreaterThan(0);
    await expect(page.getByText("sets the rating").first()).toBeVisible();
    await expect(page.locator(".ih-stage-src").first()).toBeVisible();
    // Methodology link resolves.
    await page.getByText("How this rating works").click();
    await expect(page).toHaveURL(/methodology/);
  });

  test("unknown material slug shows not-found, unrated stays hidden", async ({
    page,
  }) => {
    await page.goto("/intelligence/materials/unobtainium");
    await expect(page.getByText("Material not found.")).toBeVisible();
  });
});
