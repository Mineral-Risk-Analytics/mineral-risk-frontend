/** Shared helpers for the hub smoke suite. */
import { expect, type Page } from "@playwright/test";

export const API_BASE =
  process.env.E2E_API_URL ??
  "https://data-ingestion-reporting-development.up.railway.app";

/** Wait until a page has real content and no skeletons left.
 *  Catches both failure modes: the error note AND the infinite skeleton. */
export async function expectLoaded(page: Page, contentSelector: string) {
  await expect(page.locator(contentSelector).first()).toBeVisible();
  await expect(page.locator(".ih-skel")).toHaveCount(0);
  await expect(
    page.getByText("temporarily unavailable", { exact: false }),
  ).toHaveCount(0);
}

/** Assert every <img> on the page actually loaded (catches 404 images). */
export async function expectAllImagesLoad(page: Page) {
  const broken = await page.evaluate(() =>
    Array.from(document.images)
      .filter((img) => img.complete && img.naturalWidth === 0 && img.src)
      .map((img) => img.src),
  );
  expect(broken, `Broken images: ${broken.join(", ")}`).toHaveLength(0);
}
