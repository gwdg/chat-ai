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
          "The workspace page opens with the workspace name at the top, a combined Sources card on the left, and the Workspace Root card on the right with Workspace Root, Preview and Agents tabs.",
        shows:
          "the workspace page for Deterministic workspace with agent choices, a combined Sources card, and a Workspace Root file browser",
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

        const rootPane = page.locator('[data-guide="workspace-root-pane"]');
        const agentsTab = rootPane.getByRole("tab", { name: "Agents" });
        await expect(agentsTab).toBeVisible();
        await expect(
          page.locator('header [data-guide="workspace-agent"]'),
        ).toHaveCount(0);
        await agentsTab.click();
        const agentStrip = page.locator('[data-guide="workspace-agent"]');
        await expect(agentStrip).toBeVisible();
        for (const guide of ["browser", "opencode", "remote"]) {
          await expect(
            agentStrip.locator(`[data-guide="workspace-agent-${guide}"]`),
          ).toBeVisible();
        }
        await rootPane.getByRole("tab", { name: "Workspace Root" }).click();

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
          leftColumn.locator('[data-guide="workspace-source-pane"]'),
        ).toHaveCount(1);
        await expect(
          sourcePane.getByText(/Pick a source on the left/),
        ).toBeVisible();

        await expect(rootPane).toBeVisible();
        const cardRelations = await page.evaluate(() => {
          const sources = document.querySelector(
            '[data-guide="workspace-left-column"]',
          );
          const root = document.querySelector(
            '[data-guide="workspace-root-pane"]',
          );
          return {
            sameParent:
              !!sources && !!root && sources.parentElement === root.parentElement,
            rootInsideSources:
              sources?.querySelector('[data-guide="workspace-root-pane"]') !==
              null,
            sourcesInsideRoot:
              root?.querySelector('[data-guide="workspace-left-column"]') !==
              null,
          };
        });
        expect(cardRelations).toEqual({
          sameParent: true,
          rootInsideSources: false,
          sourcesInsideRoot: false,
        });
        await expect(
          rootPane.getByText("Workspace Root", { exact: true }),
        ).toHaveCount(1);
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
