import { expect, openApp, sendPrompt, test } from "./fixtures";

test.describe("chat", () => {
  test("sends a prompt and renders the streamed answer", async ({ page }) => {
    await openApp(page);

    await sendPrompt(page, "Hello from the deterministic suite");

    await expect(
      page.getByText("Mocked reply to: Hello from the deterministic suite", {
        exact: true,
      }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByText("Hello from the deterministic suite", { exact: true }),
    ).toBeVisible();
    await expect(page.locator('textarea[name="prompt"]')).toHaveValue("");
  });
});
