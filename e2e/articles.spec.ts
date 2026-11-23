/**
 * Article page smoke (test plan P0 #4).
 */
import { test, expect } from "@playwright/test";
import { expectAllImagesLoad, expectLoaded } from "./helpers";

test.describe("article pages", () => {
  test("first feed article renders fully with working images", async ({ page }) => {
    await page.goto("/intelligence");
    await expectLoaded(page, ".ih-recent-list a");
    await page.locator(".ih-recent-list a").first().click();
    await expect(page.locator(".ih-article-title")).toBeVisible();
    await expect(page.locator(".ih-article-body")).toBeVisible();
    // Related signals: renders with rows, or is absent — never an error.
    await expect(
      page.getByText("Couldn't load this article", { exact: false }),
    ).toHaveCount(0);
    // Give lazy images a beat, then require every one to have loaded —
    // this is the test that catches the 404 body-image class of bug.
    await page.waitForLoadState("networkidle");
    await expectAllImagesLoad(page);
    // Back link returns to the feed.
    await page.getByText("Back to Intelligence").click();
    await expect(page.locator(".ih-recent-list a").first()).toBeVisible();
  });

  test("unknown article slug shows the not-found state, not a crash", async ({
    page,
  }) => {
    await page.goto("/intelligence/this-article-does-not-exist-xyz");
    await expect(page.getByText("Article not found.")).toBeVisible();
  });
});
