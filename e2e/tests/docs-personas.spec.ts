import { mockPersonaCatalog, useDocumentationModels } from "./docs-capture";
import { expect, mockApi, openApp, sendPrompt, test } from "./fixtures";

// Screenshots for the user documentation: the persona library and a persona
// chat. The catalog of `gwdg/chat-ai-personas` is mocked, so the capture needs
// no network and the persona files stay stable.

test("browses the persona library and chats with a persona", async ({
  page,
  doc,
}) => {
  await mockApi(page, {
    // The generated title keeps the persona's name, so the sidebar in the
    // screenshot reads like a real persona chat rather than a mock title.
    title: "German to English",
    reply: (prompt: string) =>
      /Besprechung/i.test(prompt)
        ? "The meeting starts at nine o'clock."
        : `Translation of: ${prompt}`,
  });
  await useDocumentationModels(page);
  await mockPersonaCatalog(page);

  await doc.step(
    "Open the persona library",
    {
      user: "The user clicks Chat with Persona in the sidebar.",
      system:
        "The library lists the categories on the left and the personas of the repository on the right.",
      shows:
        "the Persona Library with the categories translation and examples and the quick-import entries Assistant and GWDG Support",
    },
    async () => {
      await openApp(page);
      // The button shares its row with New Chat, whose label lies over the
      // button's centre, so a pointer click would hit that label instead.
      await page
        .locator('[data-guide="import-persona"]')
        .first()
        .dispatchEvent("click");
      await expect(
        page.getByText("Persona Library", { exact: true }),
      ).toBeVisible();
    },
  );

  await doc.step(
    "Open a category",
    {
      user: "The user opens the translation category.",
      system:
        "The two translation personas appear as cards with their title and description.",
      shows:
        "the persona library with the translation category open and the cards German to English and English to German",
    },
    async () => {
      await page.getByText("translation", { exact: true }).click();
      await expect(
        page.getByText("German to English", { exact: true }),
      ).toBeVisible();
    },
  );

  await doc.step(
    "Start a persona chat",
    {
      user: "The user clicks the German to English persona.",
      system:
        "A new chat opens with the persona's title, model and system prompt, and a banner names the persona.",
      shows:
        "a new chat with the banner Persona chat · German to English and an info message about sending a German sentence",
    },
    async () => {
      await page.getByText("German to English", { exact: true }).click();
      await expect(page.getByText(/German to English/).first()).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByText(/^Persona chat/).first()).toBeVisible();
      // Leave the sidebar button's tooltip behind: the pointer is still where
      // the persona card was, which lands on New Chat after the modal closes.
      await page.mouse.move(900, 600);
    },
  );

  await doc.step(
    "Translate a sentence",
    {
      user: "The user sends a German sentence.",
      system: "The persona answers with the English translation.",
      shows:
        "the persona chat with the German question and the English answer under the persona banner",
    },
    async () => {
      await sendPrompt(page, "Die Besprechung beginnt um neun Uhr.");
      await expect(
        page.getByText("The meeting starts at nine o'clock."),
      ).toBeVisible({ timeout: 15_000 });
    },
  );
});
