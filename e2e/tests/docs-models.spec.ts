import { useDocumentationModels } from "./docs-capture";
import { expect, modelSelectorButton, openApp, test } from "./fixtures";

// Screenshot for the user documentation: the model picker with the production
// model names instead of the mock ones, so the image in ai-docs shows what a
// real deployment shows.

test("opens the model picker and chooses an external model", async ({
  page,
  doc,
}) => {
  await useDocumentationModels(page);

  await doc.step(
    "Open the model picker",
    {
      user: "The user clicks the model name in the prompt box.",
      system:
        "The picker lists the models of this deployment with their company, release date, context window and input types.",
      shows:
        "an open model picker listing DeepSeek V4.1 Flash, Gemma 4 31B Instruct, Qwen 3.6 35B A3B, GPT-5.6 Sol and Claude Sonnet 5",
    },
    async () => {
      await openApp(page);
      await (await modelSelectorButton(page)).click();
      await expect(
        page.locator(".item[data-id='openai-gpt5.6-sol']:visible").first(),
      ).toBeVisible();
    },
  );

  await doc.step(
    "Choose an externally hosted model",
    {
      user: "The user selects GPT-5.6 Sol.",
      system:
        "The prompt box shows the model with an External chip, and the data-safety indicator warns that the request leaves GWDG.",
      shows:
        "the chat page with GPT-5.6 Sol selected and an External chip in the prompt box",
    },
    async () => {
      await page
        .locator(".item[data-id='openai-gpt5.6-sol']:visible")
        .first()
        .click();
      await expect(await modelSelectorButton(page)).toContainText(
        "GPT-5.6 Sol",
      );
    },
  );
});
