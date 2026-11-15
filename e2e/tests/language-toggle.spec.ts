import { expect, openApp, test } from "./fixtures";

test.describe("language", () => {
  test("switches the interface to German", async ({ page }) => {
    await openApp(page);

    await page.locator('button:has(img[alt="de language flag"])').click();

    await expect(page.getByText("Impressum", { exact: true })).toBeVisible();
    await expect(
      page.getByText("niemals auf unseren Servern gespeichert", {
        exact: false,
      }),
    ).toBeVisible();
  });
});
