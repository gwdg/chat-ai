import {
  dismissWelcome,
  expect,
  openApp,
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
      },
      async () => {
        await openApp(page);
        await sendPrompt(page, "Persist this exchange");
        await expect(
          page.getByText("Mocked reply to: Persist this exchange", {
            exact: true,
          }),
        ).toBeVisible({ timeout: 20_000 });
      },
    );

    await doc.step(
      "Wait until the chat is stored",
      {
        user: "The user looks at the sidebar.",
        system:
          "The generated title appears in the chat list, which proves the conversation was written to IndexedDB before the reload.",
      },
      async () => {
        // The title is generated after the reply and written in the same
        // conversation update. The sidebar is a live IndexedDB query, so seeing
        // the title there guarantees the row was persisted before the reload,
        // instead of racing the sync hook. The header shows a rename button only
        // on desktop.
        await expect(
          page.getByText("Mocked conversation title").first(),
        ).toBeVisible({ timeout: 20_000 });
      },
    );

    await doc.step(
      "Reload the page",
      {
        user: "The user reloads the browser tab.",
        system:
          "The app rehydrates the conversation from IndexedDB: the same prompt, the same answer and the same title are shown again.",
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
