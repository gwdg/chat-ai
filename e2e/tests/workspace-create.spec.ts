import { expect, openApp, openSidebar, test } from "./fixtures";

test.describe("workspace", () => {
  test("creates a workspace and opens its file browser", async ({ page }) => {
    await openApp(page);
    await openSidebar(page);

    await page.getByRole("button", { name: "New workspace" }).click();

    const nameField = page.getByPlaceholder("e.g. Research");
    await expect(nameField).toBeVisible();
    await nameField.fill("Deterministic workspace");
    await page
      .getByRole("button", { name: "Create workspace", exact: true })
      .click();

    await expect(page).toHaveURL(/\/workspace\/[^/]+$/);
    await expect(
      page.getByText("Deterministic workspace", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Workspace Root" }),
    ).toBeVisible();
    await expect(page.getByText("Available storage")).toBeVisible();
    await expect(page.locator('[data-guide="workspace-files"]')).toBeVisible();

    await openSidebar(page);
    await expect(
      page.getByText("Deterministic workspace").first(),
    ).toBeVisible();
  });
});
