import { closeSidebarOverlay, expect, openApp, test } from "./fixtures";

/**
 * The lean build (`fixtures/front.e2e-gated.json`) has GWDG Tools, Arcana, the
 * browser agent, the Agents module, feedback, choices and sync switched off. Its
 * own Vite server runs it on port 8094, because the modules are compiled in at
 * startup.
 *
 * The catalogs must hide every guide those modules carry and keep the ones that
 * do not depend on them — including the Meta-chat guides, the backup guides and
 * the advanced-mode guide, whose switch still reveals the MCP Servers section
 * because that is a deployment feature, not a module.
 */
test.describe("tutorial: catalog on a lean build", () => {
  test("hides the guides the modules switched off", async ({ page, doc }) => {
    const tutorial = (title: string) =>
      page.getByRole("button", { name: title, exact: true });
    const useCase = (title: string) =>
      page.getByRole("button", { name: title, exact: true });

    await doc.step(
      "Open the tutorial catalog on the lean build",
      {
        user: "The user opens the Meta chat and clicks Browse tutorials.",
        system:
          "The catalog opens. Tools, agent, Arcana, feedback and speech guides are absent because those modules are off in this build, while the backup, settings and Meta-chat guides stay.",
        shows:
          "the Meta chat with the tutorial catalog open above the prompt box",
      },
      async () => {
        await openApp(page, "/meta");
        await closeSidebarOverlay(page);
        await page.locator('[data-guide="browse-tutorials"]').click();
        await expect(page.getByLabel("Search tutorials")).toBeVisible();

        for (const title of [
          "Use GWDG Tools",
          "Spawn a remote agent",
          "Use Arcana for RAG",
          "Send feedback",
          "Read answers aloud",
          "Encrypted server synchronization",
        ]) {
          await expect(tutorial(title)).toHaveCount(0);
        }

        for (const title of [
          "Create an encrypted backup",
          "Restore an encrypted backup",
          "Show agents and MCP servers in the sidebar",
          "Manage MCP servers from the Meta chat",
        ]) {
          await expect(tutorial(title)).toHaveCount(1);
        }
      },
    );

    await doc.step(
      "Search for a guide this build cannot run",
      {
        user: "The user searches for “GWDG Tools”.",
        system:
          "The tools module is off, so the catalog reports that no tutorials were found instead of offering a walkthrough that cannot run.",
        shows:
          "the tutorial catalog with the message No tutorials found.",
      },
      async () => {
        await page.getByLabel("Search tutorials").fill("GWDG Tools");
        await expect(tutorial("Use GWDG Tools")).toHaveCount(0);
        await expect(page.getByText("No tutorials found.")).toBeVisible();
      },
    );

    await doc.step(
      "Find the backup guides",
      {
        user: "The user searches for “backup”.",
        system:
          "Both backup guides stay available because encrypted backup needs no module: one creates the file, one restores it.",
        shows:
          "the tutorial catalog filtered to Create an encrypted backup and Restore an encrypted backup",
      },
      async () => {
        await page.getByLabel("Search tutorials").fill("backup");
        await expect(tutorial("Create an encrypted backup")).toBeVisible();
        await expect(tutorial("Restore an encrypted backup")).toBeVisible();
        await expect(tutorial("Use GWDG Tools")).toHaveCount(0);
      },
    );

    await doc.step(
      "Find the advanced-mode guide",
      {
        user: "The user searches for “Show agents”.",
        system:
          "The advanced-mode guide remains: its switch can still reveal the MCP Servers section, because that list is a deployment feature rather than a module.",
        shows:
          "the tutorial catalog listing the guide Show agents and MCP servers in the sidebar",
      },
      async () => {
        await page.getByLabel("Search tutorials").fill("Show agents");
        await expect(
          tutorial("Show agents and MCP servers in the sidebar"),
        ).toBeVisible();
      },
    );

    await doc.step(
      "Open the use-case catalog",
      {
        user: "The user closes the tutorials, opens Browse use cases and searches for “new device”.",
        system:
          "The research, Arcana, image and read-aloud walkthroughs are not offered; the backup walkthrough is, so the user expands it to read the four steps.",
        shows:
          "the expanded Move your chats to a new device walkthrough with its four steps and a Walk me through button",
      },
      async () => {
        await page.locator('[data-guide="browse-tutorials"]').click();
        await page.locator('[data-guide="browse-use-cases"]').click();
        await expect(page.getByLabel("Search use cases")).toBeVisible();

        for (const title of [
          "Research current information",
          "Answer questions from your own documents",
          "Create an image for a slide",
          "Listen to an answer",
        ]) {
          await expect(useCase(title)).toHaveCount(0);
        }

        for (const title of [
          "Move your chats to a new device",
          "Find an old chat",
        ]) {
          await expect(useCase(title)).toHaveCount(1);
        }

        await page.getByLabel("Search use cases").fill("new device");
        await useCase("Move your chats to a new device").click();
        await expect(
          page.getByText(
            "Create the backup under Encrypted backup, with a passphrase you can remember.",
          ),
        ).toBeVisible();
      },
    );

    await doc.step(
      "Start the backup walkthrough",
      {
        user: "The user clicks Walk me through.",
        system:
          "The catalog closes and the tour panel opens on Step 1 of 4, which points at the new-chat button in the sidebar.",
        shows:
          "the Meta chat with the Move your chats to a new device tour at Step 1 of 4",
      },
      async () => {
        await page.getByRole("button", { name: "Walk me through" }).click();

        const panel = page.locator("div[data-guide-keep-open]");
        await expect(panel).toContainText("Move your chats to a new device");
        await expect(panel).toContainText("Step 1 of 4");
        await expect(panel).toContainText(
          "Start a new chat for this workflow.",
        );
      },
    );
  });
});
