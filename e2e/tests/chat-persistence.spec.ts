import {
  MOCK_TITLE,
  dismissWelcome,
  expect,
  openApp,
  openSidebar,
  sendPrompt,
  test,
} from "./fixtures";

test.describe("chat persistence", () => {
  test("keeps the conversation and the answer across a reload", async ({
    page,
    doc,
  }) => {
    await doc.step(
      "Open the app and send a message",
      {
        user: "The user opens Chat AI and asks to persist the exchange.",
        system:
          "The conversation is created, the answer streams in and a title is generated for the chat.",
        shows:
          "the conversation area containing the prompt Persist this exchange at its top right and the assistant answer Mocked reply to: Persist this exchange beneath it",
      },
      async () => {
        await openApp(page);
        await sendPrompt(page, "Persist this exchange");
        await expect(
          page.getByText("Mocked reply to: Persist this exchange", {
            exact: true,
          }),
        ).toBeVisible({ timeout: 20_000 });
        await expect(
          page.getByText("Persist this exchange", { exact: true }),
        ).toBeVisible();
        await expect(page.locator('textarea[name="prompt"]')).toHaveValue("");
      },
    );

    await doc.step(
      "Wait until the chat is stored",
      {
        user: "The user looks at the sidebar.",
        system:
          "The generated title appears in the chat list, which proves the conversation was written to IndexedDB before the reload.",
        shows: `the sidebar chat list containing the title ${MOCK_TITLE}`,
      },
      async () => {
        // The title is generated after the reply and written in the same
        // conversation update. The sidebar is a live IndexedDB query, so seeing
        // the title there guarantees the row was persisted before the reload,
        // instead of racing the sync hook. The header shows a rename button only
        // on desktop.
        await expect(page.getByText(MOCK_TITLE).first()).toBeVisible({
          timeout: 20_000,
        });
        // On tablets and phones the sidebar is an overlay. Open it so the
        // screenshot also shows the persisted title instead of a hidden drawer.
        await openSidebar(page);
      },
    );

    await doc.step(
      "Reload the page",
      {
        user: "The user reloads the browser tab.",
        system:
          "The app rehydrates the conversation from IndexedDB: the same prompt, the same answer and the same title are shown again.",
        shows:
          "the conversation area after a reload, still containing the prompt Persist this exchange at its top right and the assistant answer Mocked reply to: Persist this exchange beneath it",
      },
      async () => {
        await page.reload();
        await dismissWelcome(page);

        await expect(
          page.getByText("Persist this exchange", { exact: true }),
        ).toBeVisible({ timeout: 20_000 });
        await expect(
          page.getByText("Mocked reply to: Persist this exchange", {
            exact: true,
          }),
        ).toBeVisible();
      },
    );
  });
});
