import { expect, modelSelectorButton, openApp, test } from "./fixtures";

test.describe("model selector", () => {
  test("switches the conversation model from the prompt box", async ({
    page,
    doc,
  }) => {
    await doc.step(
      "Open a chat",
      {
        user: "The user opens Chat AI.",
        system:
          "The conversation starts with the default model, Alpha Mock Model.",
        shows:
          "the chat page with a model selector showing Alpha Mock Model",
      },
      async () => {
        await openApp(page);
        await expect(await modelSelectorButton(page)).toContainText(
          "Alpha Mock Model",
        );
      },
    );

    await doc.step(
      "Open the model picker",
      {
        user: "The user clicks the model chip in the prompt box.",
        system:
          "A picker lists the models available in this deployment, including Beta Mock Model.",
        shows:
          "an open model picker that contains Beta Mock Model above the chat",
      },
      async () => {
        const selector = await modelSelectorButton(page);
        await selector.click();
        await expect(
          page.locator('.item[data-id="beta-mock-model"]:visible').first(),
        ).toBeVisible();
      },
    );

    await doc.step(
      "Choose another model",
      {
        user: "The user selects Beta Mock Model.",
        system:
          "The picker closes and the prompt box now shows Beta Mock Model for this conversation.",
        shows:
          "the chat page with the model selector showing Beta Mock Model",
      },
      async () => {
        await page
          .locator('.item[data-id="beta-mock-model"]:visible')
          .first()
          .click();
        await expect(await modelSelectorButton(page)).toContainText(
          "Beta Mock Model",
        );
      },
    );
  });
});
