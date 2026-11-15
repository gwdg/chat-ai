import { expect, openApp, openSidebar, test } from "./fixtures";

test.describe("workspace", () => {
  test("creates a workspace and opens its file browser", async ({
    page,
    doc,
  }) => {
    await doc.step(
      "Open the sidebar",
      {
        user: "The user opens Chat AI and reveals the sidebar.",
        system:
          "The workspace section is visible with a New workspace action.",
        shows:
          "the Chat AI page with the sidebar visible and a New workspace action",
      },
      async () => {
        await openApp(page);
        await openSidebar(page);
      },
    );

    await doc.step(
      "Open the create-workspace form",
      {
        user: "The user clicks New workspace.",
        system:
          "A small form asks for a workspace name, pre-filled with a placeholder example.",
        shows: "a create workspace form with an input for the workspace name",
      },
      async () => {
        await page.getByRole("button", { name: "New workspace" }).click();
        await expect(page.getByPlaceholder("e.g. Research")).toBeVisible();
      },
    );

    await doc.step(
      "Create the workspace",
      {
        user: "The user names it “Deterministic workspace” and confirms.",
        system:
          "The workspace page opens with its storage list, root folder and file browser.",
        shows:
          "the workspace page for Deterministic workspace with a storage list and a file browser",
      },
      async () => {
        await page
          .getByPlaceholder("e.g. Research")
          .fill("Deterministic workspace");
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
        await expect(
          page.locator('[data-guide="workspace-files"]'),
        ).toBeVisible();
      },
    );

    await doc.step(
      "Find the workspace in the sidebar",
      {
        user: "The user reopens the sidebar.",
        system:
          "The new workspace is listed alongside the chats, so it can be opened again later.",
        shows:
          "the sidebar listing the workspace Deterministic workspace",
      },
      async () => {
        await openSidebar(page);
        await expect(
          page.getByText("Deterministic workspace", { exact: true }).first(),
        ).toBeVisible();
      },
    );
  });
});
