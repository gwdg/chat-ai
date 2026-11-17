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
          "The workspace page opens with the agent choices beside the workspace name, the Sources rail on the left, and the Workspace Root browser on the right.",
        shows:
          "the workspace page for Deterministic workspace with agent choices, a Sources rail, and a Workspace Root file browser",
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

        const agentStrip = page.locator('[data-guide="workspace-agent"]');
        await expect(agentStrip).toBeVisible();
        for (const guide of ["browser", "opencode", "remote"]) {
          await expect(
            agentStrip.locator(`[data-guide="workspace-agent-${guide}"]`),
          ).toBeVisible();
        }

        const leftColumn = page.locator(
          '[data-guide="workspace-left-column"]',
        );
        for (const guide of ["device", "chats", "arcanas"]) {
          await expect(
            leftColumn.locator(`[data-guide="workspace-source-${guide}"]`),
          ).toBeVisible();
        }
        await expect(page.getByText("Available storage")).toHaveCount(0);

        const sourcePane = page.locator(
          '[data-guide="workspace-source-pane"]',
        );
        await expect(sourcePane).toBeVisible();
        await expect(
          sourcePane.getByText(/Pick a source on the left/),
        ).toBeVisible();

        const rootPane = page.locator('[data-guide="workspace-root-pane"]');
        await expect(rootPane).toBeVisible();
        await expect(
          rootPane.getByText("Workspace Root", { exact: true }),
        ).toBeVisible();
        await expect(
          rootPane.locator('[data-guide="workspace-files"]'),
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
