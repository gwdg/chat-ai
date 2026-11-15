import {
  closeSidebarOverlay,
  expect,
  modelSelectorButton,
  openApp,
  showTutorialPanel,
  startTutorial,
  test,
} from "./fixtures";

test.describe("tutorial: select a model", () => {
  test("completes the one-step guide by opening the model selector", async ({
    page,
    doc,
  }) => {
    let panel = page.locator("div[data-guide-keep-open]");

    await doc.step(
      "Start the Select a model tutorial",
      {
        user: "The user opens the Meta chat and starts the “Select a model” tutorial.",
        system:
          "The panel shows Step 1 of 1 and waits for the user to open the model selector. Done is disabled until then.",
      },
      async () => {
        await openApp(page, "/meta");

        panel = await startTutorial(page, "Select a model");
        await expect(panel).toContainText("Step 1 of 1");
        await expect(panel).toContainText(
          "Waiting for you to complete this step",
        );
        await expect(panel.getByRole("button", { name: "Done" })).toBeDisabled();
      },
    );

    await doc.step(
      "Open the model selector",
      {
        user: "The user closes the sidebar overlay and clicks the model chip.",
        system:
          "The model picker opens and the tutorial recognises the click as the completed step.",
      },
      async () => {
        // The overlay drawer would cover the selector on small screens.
        await closeSidebarOverlay(page);
        const selector = await modelSelectorButton(page);
        await selector.click();
        // Close the opened picker again so it cannot cover the header on phones.
        // Escape would close the tutorial itself.
        await selector.click();
      },
    );

    await doc.step(
      "Finish the tutorial",
      {
        user: "The user reopens the tutorial panel and clicks Done.",
        system:
          "The guide notices the selector click, marks its only step complete and automatically advances to Tutorial complete. Done closes the panel.",
      },
      async () => {
        panel = await showTutorialPanel(page);
        // Opening the selector completes the only step; the guide then advances
        // itself after a short delay, so wait for the terminal state instead of
        // racing the transient "Step complete" label.
        await expect(panel).toContainText("Tutorial complete", {
          timeout: 10_000,
        });
        await panel.getByRole("button", { name: "Done" }).click();
        await expect(panel).toHaveCount(0);
      },
    );
  });
});
