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
    doc,
  }) => {
    let panel = page.locator("div[data-guide-keep-open]");

    await doc.step(
      "Start the catalog tutorial",
      {
        user: "The user opens the Meta chat and starts “Find tutorials and settings in Meta chat”.",
        system:
          "The tutorial panel appears with Step 1 of 4 and asks the user to open the tutorial catalog.",
      },
      async () => {
        await openApp(page, "/meta");

        panel = await startTutorial(
          page,
          "Find tutorials and settings in Meta chat",
        );
        await expect(panel).toContainText("Step 1 of 4");
      },
    );

    await doc.step(
      "Open the tutorial catalog",
      {
        user: "The user clicks the tutorials button above the prompt box.",
        system:
          "The tutorial catalog opens and the guide advances to Step 2 of 4, which asks for the use-case catalog.",
      },
      async () => {
        // Step 1: open the tutorial catalog.
        await closeSidebarOverlay(page);
        await page.locator('[data-guide="browse-tutorials"]').click();
        panel = await showTutorialPanel(page);
        await panel.getByRole("button", { name: "Next" }).click();
        await expect(panel).toContainText("Step 2 of 4");
      },
    );

    await doc.step(
      "Open the use-case catalog",
      {
        user: "The user clicks the use-cases button beside it.",
        system:
          "Both catalogs are open and the guide advances to Step 3 of 4, which is completed by sending a message.",
      },
      async () => {
        // Step 2: open the use-case catalog beside it.
        await closeSidebarOverlay(page);
        await page.locator('[data-guide="browse-use-cases"]').click();
        panel = await showTutorialPanel(page);
        await panel.getByRole("button", { name: "Next" }).click();
        await expect(panel).toContainText("Step 3 of 4");
      },
    );

    await doc.step(
      "Send the first tutorial message",
      {
        user: "The user closes the catalogs and sends “First tutorial message”.",
        system:
          "The answer streams in and the guide advances to Step 4 of 4.",
      },
      async () => {
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
      },
    );

    await doc.step(
      "Send the second message and finish",
      {
        user: "The user sends “Second tutorial message” and clicks Done.",
        system:
          "The answer streams in, the tutorial reports Tutorial complete and the panel is removed.",
      },
      async () => {
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
      },
    );
  });
});
