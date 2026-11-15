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
  }) => {
    await openApp(page, "/meta");

    let panel = await startTutorial(page, "Select a model");
    await expect(panel).toContainText("Step 1 of 1");
    await expect(panel).toContainText(
      "Waiting for you to complete this step",
    );
    await expect(panel.getByRole("button", { name: "Done" })).toBeDisabled();

    // The overlay drawer would cover the selector on small screens.
    await closeSidebarOverlay(page);
    const selector = await modelSelectorButton(page);
    await selector.click();
    // Close the opened picker again so it cannot cover the header on phones.
    // Escape would close the tutorial itself.
    await selector.click();

    panel = await showTutorialPanel(page);
    await expect(panel).toContainText("Step complete");
    await expect(panel.getByRole("button", { name: "Done" })).toBeEnabled();
    await panel.getByRole("button", { name: "Done" }).click();

    await expect(panel).toContainText("Tutorial complete");
    await panel.getByRole("button", { name: "Done" }).click();
    await expect(panel).toHaveCount(0);
  });
});
