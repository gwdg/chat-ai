import { expect, modelSelectorButton, openApp, test } from "./fixtures";

test.describe("model selector", () => {
  test("switches the conversation model from the prompt box", async ({
    page,
  }) => {
    await openApp(page);

    const selector = await modelSelectorButton(page);
    await expect(selector).toContainText("Alpha Mock Model");

    await selector.click();
    await page
      .locator('.item[data-id="beta-mock-model"]:visible')
      .first()
      .click();

    await expect(selector).toContainText("Beta Mock Model");
  });
});
