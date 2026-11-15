import { expect, openApp, startTutorial, test } from "./fixtures";

test.describe("tutorial: search chats", () => {
  test("completes the gated two-step guide", async ({ page }) => {
    await openApp(page, "/meta");

    const panel = await startTutorial(page, "Search chats");
    await expect(panel).toContainText("Step 1 of 2");

    await page.locator('[data-guide="search-chats"]').click();

    await expect(panel).toContainText("Step 2 of 2");
    const search = page.locator('[data-guide="search-input"]');
    await expect(search).toBeVisible();
    await expect(panel).toContainText(
      "Waiting for you to complete this step",
    );

    await search.fill("hello");

    await expect(panel).toContainText("Tutorial complete", {
      timeout: 15_000,
    });
    await panel.getByRole("button", { name: "Done" }).click();
    await expect(panel).toHaveCount(0);
  });
});
