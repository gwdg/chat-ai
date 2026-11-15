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
  }) => {
    await openApp(page);
    await sendPrompt(page, "Persist this exchange");
    await expect(
      page.getByText("Mocked reply to: Persist this exchange", { exact: true }),
    ).toBeVisible({ timeout: 20_000 });
    // The title is generated after the reply and written in the same
    // conversation update. The sidebar is a live IndexedDB query, so seeing the
    // title there guarantees the row was persisted before the reload, instead of
    // racing the sync hook. The header shows a rename button only on desktop.
    await expect(
      page.getByText("Mocked conversation title").first(),
    ).toBeVisible({ timeout: 20_000 });

    await page.reload();
    await dismissWelcome(page);

    await expect(
      page.getByText("Persist this exchange", { exact: true }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByText("Mocked reply to: Persist this exchange", { exact: true }),
    ).toBeVisible();
  });
});
