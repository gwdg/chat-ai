import { dismissWelcome, expect, openApp, test } from "./fixtures";

test.describe("theme", () => {
  test("toggles dark mode and keeps it after a reload", async ({ page }) => {
    await openApp(page);

    const html = page.locator("html");
    await expect(html).not.toHaveClass(/dark/);

    await page.locator('[data-guide="theme-toggle"]').click();
    await expect(html).toHaveClass(/dark/);

    await page.reload();
    await dismissWelcome(page);
    await expect(html).toHaveClass(/dark/);

    await page.locator('[data-guide="theme-toggle"]').click();
    await expect(html).not.toHaveClass(/dark/);
  });
});
