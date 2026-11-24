import { expect, openApp, openSidebar, test } from "./fixtures";

const WORKSPACE_NAME = "Deterministic workspace";

/**
 * Create-workspace flow.
 *
 * The dialog itself owns the storage browser (the Sources rail and the
 * Workspace Root browser); the page it opens is the workspace's chat home, with
 * the file tree, the agent choices and the what's-new report in the right-hand
 * panel. The scenario therefore checks both halves: the dialog before creating,
 * and the panel afterwards.
 */
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
          "The create-workspace dialog opens: a name field, and below it the storage browser with a Sources rail on the left and the workspace root on the right.",
        shows:
          "a create workspace dialog with a workspace name field and its storage browser",
      },
      async () => {
        await page.getByRole("button", { name: "New workspace" }).click();

        const create = page.getByRole("dialog");
        await expect(create.getByLabel("Workspace name")).toBeVisible();
        await expect(
          create.locator('[data-guide="workspace-sources"]'),
        ).toBeVisible();
        await expect(
          create.locator('[data-guide="workspace-files"]'),
        ).toBeVisible();
      },
    );

    // The right-hand panel is `hidden` below the md breakpoint, so a phone
    // shows the chat home without it. From md up it starts collapsed to a rail
    // below the 1280 px desktop breakpoint, so a tablet has to expand it.
    const wideLayout = (page.viewportSize()?.width ?? 1280) >= 768;

    await doc.step(
      "Create the workspace",
      {
        user: "The user names it “Deterministic workspace” and confirms.",
        system: wideLayout
          ? "The workspace page opens as that workspace's chat home. Its right-hand panel offers the what's-new report and the Files tree; the agent choices live on the workspace page itself."
          : "The workspace page opens as that workspace's chat home. On a phone the right-hand panel is hidden by the responsive layout, so only the chat and the prompt box are shown.",
        shows: wideLayout
          ? "the workspace page for Deterministic workspace with an empty chat list, a prompt box, and a right-hand panel with What's New and Files tabs"
          : "the workspace page for Deterministic workspace on a phone, with an empty chat list and a prompt box",
      },
      async () => {
        await page
          .getByRole("dialog")
          .getByLabel("Workspace name")
          .fill(WORKSPACE_NAME);
        await page.getByTestId("create-workspace-create").click();

        await expect(page).toHaveURL(/\/workspace\/[^/]+$/);
        await expect(
          page.getByRole("heading", { name: WORKSPACE_NAME }),
        ).toBeVisible();
        await expect(
          page.getByText("No chats in this workspace yet"),
        ).toBeVisible();

        // The storage no longer has a card of its own on the page: it is the
        // Files tab of the shared right-hand panel.
        if (!wideLayout) {
          await expect(
            page.locator('[data-guide="meta-tab-strip"]'),
          ).toHaveCount(0);
          return;
        }

        const expand = page.getByRole("button", {
          name: "Expand What's New",
        });
        if (await expand.isVisible().catch(() => false)) await expand.click();
        await expect(
          page.locator('[data-guide="meta-tab-strip"]'),
        ).toBeVisible();

        const filesTab = page.getByRole("tab", { name: "Files" });
        await expect(filesTab).toBeVisible();
        // The Agents tab was removed from the right sidebar; the agent choices
        // live on the workspace page itself.
        await expect(page.getByRole("tab", { name: "Agents" })).toHaveCount(0);
        // The Preview tab only exists while it holds a file.
        await expect(page.locator('[data-guide="meta-tab-preview"]')).toHaveCount(
          0,
        );
        // The agent choices are not part of the page header either.
        await expect(
          page.locator('header [data-guide="workspace-agent"]'),
        ).toHaveCount(0);

        await filesTab.click();
        await expect(
          page.locator('[data-guide="workspace-storage-tree"]'),
        ).toBeVisible();
        await expect(
          page.locator('[data-guide="workspace-files"]'),
        ).toBeVisible();
        await expect(
          page.locator('[data-guide="workspace-upload"]'),
        ).toBeVisible();
      },
    );

    await doc.step(
      "Find the workspace in the sidebar",
      {
        user: "The user reopens the sidebar.",
        system:
          "The new workspace is listed alongside the chats, so it can be opened again later.",
        shows: "the sidebar listing the workspace Deterministic workspace",
      },
      async () => {
        await openSidebar(page);
        await expect(
          page.getByText(WORKSPACE_NAME, { exact: true }).first(),
        ).toBeVisible();
      },
    );
  });
});
