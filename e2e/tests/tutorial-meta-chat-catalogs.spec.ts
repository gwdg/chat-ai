import {
  closeSidebarOverlay,
  expect,
  openApp,
  sendPrompt,
  showTutorialPanel,
  startTutorial,
  test,
} from "./fixtures";

test.describe("tutorial: meta chat catalogs", () => {
  test("walks through the four-step catalog guide with two messages", async ({
    page,
  }) => {
    await openApp(page, "/meta");

    let panel = await startTutorial(
      page,
      "Find tutorials and settings in Meta chat",
    );
    await expect(panel).toContainText("Step 1 of 4");

    // Step 1: open the tutorial catalog.
    await closeSidebarOverlay(page);
    await page.locator('[data-guide="browse-tutorials"]').click();
    panel = await showTutorialPanel(page);
    await panel.getByRole("button", { name: "Next" }).click();
    await expect(panel).toContainText("Step 2 of 4");

    // Step 2: open the use-case catalog beside it.
    await closeSidebarOverlay(page);
    await page.locator('[data-guide="browse-use-cases"]').click();
    panel = await showTutorialPanel(page);
    await panel.getByRole("button", { name: "Next" }).click();
    await expect(panel).toContainText("Step 3 of 4");

    // The open catalogs sit above the prompt box, so close them before typing.
    await closeSidebarOverlay(page);
    for (const selector of [
      '[data-guide="browse-tutorials"]',
      '[data-guide="browse-use-cases"]',
    ]) {
      const toggle = page.locator(selector);
      if ((await toggle.getAttribute("aria-expanded")) === "true") {
        await toggle.click();
      }
    }

    // Step 3 and 4 both complete when a message finishes streaming.
    await sendPrompt(page, "First tutorial message");
    await expect(
      page.getByText("Mocked reply to: First tutorial message", {
        exact: true,
      }),
    ).toBeVisible({ timeout: 20_000 });
    panel = await showTutorialPanel(page);
    await expect(panel).toContainText("Step 4 of 4", { timeout: 15_000 });

    await closeSidebarOverlay(page);
    await sendPrompt(page, "Second tutorial message");
    await expect(
      page.getByText("Mocked reply to: Second tutorial message", {
        exact: true,
      }),
    ).toBeVisible({ timeout: 20_000 });

    panel = await showTutorialPanel(page);
    await expect(panel).toContainText("Tutorial complete", {
      timeout: 15_000,
    });
    await panel.getByRole("button", { name: "Done" }).click();
    await expect(panel).toHaveCount(0);
  });
});
