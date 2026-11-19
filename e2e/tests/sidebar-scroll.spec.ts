import { expect, openApp, openSidebar, test } from "./fixtures";
import type { Page } from "@playwright/test";

/**
 * Opening a topic or a workspace replaces the whole page, and with it the
 * sidebar component. The list must come back at the offset the user left it at,
 * instead of jumping to the first row.
 */

// A short viewport makes a handful of topics overflow the list.
test.use({ viewport: { width: 1440, height: 560 } });

const TOPIC_COUNT = 12;

async function createTopic(page: Page, name: string): Promise<void> {
  await page.locator('[data-guide="create-topic"]').click();
  await page.locator('[data-guide="topic-create-input"]').fill(name);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
}

/**
 * Click a sidebar row without Playwright's scroll-into-view: the leftover
 * position is what the test measures, so the click must not move the list.
 *
 * A freshly mounted sidebar paints the previous rows from the list snapshot and
 * swaps them for the query's rows a frame later, so a node that was resolved
 * just before the swap is detached and its click is lost. Retry until the click
 * actually navigates.
 */
async function clickRow(
  page: Page,
  name: string,
  target: RegExp,
): Promise<void> {
  await expect(async () => {
    await page
      .getByText(name, { exact: true })
      .evaluate((element) => (element as HTMLElement).click());
    await expect(page).toHaveURL(target, { timeout: 800 });
  }).toPass({ timeout: 10_000 });
}

async function listScrollTop(page: Page): Promise<number> {
  return page
    .locator('[data-guide="sidebar-list"]')
    .evaluate((element) => element.scrollTop);
}

async function scrollToListEnd(page: Page): Promise<number> {
  await page.locator('[data-guide="sidebar-list"]').evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  return listScrollTop(page);
}

/**
 * The same list can be a few pixels shorter on the new page; what matters is
 * that the sidebar comes back where the user left it, not at the first row.
 */
async function expectListNear(page: Page, before: number): Promise<void> {
  await expect
    .poll(() => listScrollTop(page), { timeout: 5_000 })
    .toBeGreaterThan(0);
  const after = await listScrollTop(page);
  expect(Math.abs(after - before)).toBeLessThanOrEqual(64);
}

async function seedTopics(page: Page): Promise<void> {
  for (let index = 1; index <= TOPIC_COUNT; index += 1) {
    await createTopic(page, `Scroll topic ${index}`);
  }
}

test.describe("sidebar list scroll", () => {
  test("keeps the list position when a topic opens its page", async ({
    page,
  }) => {
    await openApp(page);
    await openSidebar(page);
    await seedTopics(page);

    const before = await scrollToListEnd(page);
    expect(before).toBeGreaterThan(0);

    await clickRow(page, `Scroll topic ${TOPIC_COUNT}`, /\/topic\//);

    // The new sidebar restores the offset before painting, but its rows arrive
    // from IndexedDB after the first render, so allow a short retry window.
    await expectListNear(page, before);
  });

  test("keeps the list position when a workspace opens its page", async ({
    page,
  }) => {
    await openApp(page);
    await openSidebar(page);
    await seedTopics(page);

    await page.getByRole("button", { name: "New workspace" }).click();
    await page.getByPlaceholder("e.g. Research").fill("Scroll workspace");
    await page
      .getByRole("button", { name: "Create workspace", exact: true })
      .click();
    await expect(page).toHaveURL(/\/workspace\/[^/]+$/);

    // The workspace page has its own sidebar; leave it for a topic page, so the
    // measured offset is taken on the same list the workspace row sits in.
    await clickRow(page, "Scroll topic 1", /\/topic\//);

    const before = await scrollToListEnd(page);
    expect(before).toBeGreaterThan(0);

    await clickRow(page, "Scroll workspace", /\/workspace\/[^/]+$/);

    await expectListNear(page, before);
  });
});
