import { closeSidebarOverlay, expect, openApp, test } from "./fixtures";

/**
 * The default mocked app (`fixtures/front.e2e.json`) has GWDG Tools, Arcana and
 * the Agents module on, while feedback, speech and sync are off. The tutorial
 * and use-case catalogs must follow that build: they are the deployment-facing
 * entry point into every tour, so a guide whose module is off has to disappear
 * instead of pointing at UI that does not exist.
 *
 * The mirrored run on a lean build is `tutorial-catalog-gated.spec.ts`.
 */
test.describe("tutorial: catalog availability", () => {
  test("lists the guides this deployment can run", async ({ page, doc }) => {
    const tutorial = (title: string) =>
      page.getByRole("button", { name: title, exact: true });

    await doc.step(
      "Open the tutorial catalog",
      {
        user: "The user opens the Meta chat and clicks Browse tutorials above the prompt box.",
        system:
          "The catalog opens with its search field, the Hide completed switch and the guides grouped by category.",
        shows:
          "the Meta chat with the tutorial catalog open above the prompt box",
      },
      async () => {
        await openApp(page, "/meta");
        await closeSidebarOverlay(page);
        await page.locator('[data-guide="browse-tutorials"]').click();
        await expect(page.getByLabel("Search tutorials")).toBeVisible();

        // Modules on in this build.
        for (const title of [
          "Use GWDG Tools",
          "Spawn a remote agent",
          "Use Arcana for RAG",
          "Show agents and MCP servers in the sidebar",
          "Create an encrypted backup",
          "Restore an encrypted backup",
        ]) {
          await expect(tutorial(title)).toHaveCount(1);
        }

        // Modules off in this build: feedback, speech and sync.
        for (const title of [
          "Send feedback",
          "Read answers aloud",
          "Encrypted server synchronization",
        ]) {
          await expect(tutorial(title)).toHaveCount(0);
        }
      },
    );

    await doc.step(
      "Search a guide whose module is on",
      {
        user: "The user types “GWDG Tools” into Search tutorials.",
        system:
          "The catalog narrows to the GWDG Tools guide, which this build can run because the tools module is enabled.",
        shows:
          "the tutorial catalog filtered to the Use GWDG Tools guide",
      },
      async () => {
        await page.getByLabel("Search tutorials").fill("GWDG Tools");
        await expect(tutorial("Use GWDG Tools")).toBeVisible();
        await expect(tutorial("Use Arcana for RAG")).toHaveCount(0);
      },
    );

    await doc.step(
      "Search a guide whose module is off",
      {
        user: "The user searches for “feedback”.",
        system:
          "Feedback is switched off in this build, so the catalog reports that no tutorials were found instead of offering a walkthrough that cannot run.",
        shows:
          "the tutorial catalog with the message No tutorials found.",
      },
      async () => {
        await page.getByLabel("Search tutorials").fill("feedback");
        await expect(tutorial("Send feedback")).toHaveCount(0);
        await expect(page.getByText("No tutorials found.")).toBeVisible();
      },
    );

    await doc.step(
      "Search the two backup guides",
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
      "Open and read the use-case catalog",
      {
        user: "The user closes the tutorial catalog, opens Browse use cases, searches for “new device” and expands the walkthrough.",
        system:
          "The card shows the description, the four numbered steps and the two tutorial links. Tools-backed walkthroughs are offered and the speech walkthrough is not.",
        shows:
          "the expanded Move your chats to a new device walkthrough with its four steps and a Walk me through button",
      },
      async () => {
        await page.locator('[data-guide="browse-tutorials"]').click();
        await page.locator('[data-guide="browse-use-cases"]').click();

        const useCase = (title: string) =>
          page.getByRole("button", { name: title, exact: true });

        await expect(page.getByLabel("Search use cases")).toBeVisible();
        await expect(page.getByLabel("Search tutorials")).toHaveCount(0);
        await expect(useCase("Research current information")).toHaveCount(1);
        await expect(useCase("Move your chats to a new device")).toHaveCount(1);
        await expect(useCase("Listen to an answer")).toHaveCount(0);

        await page.getByLabel("Search use cases").fill("new device");
        await useCase("Move your chats to a new device").click();

        await expect(
          page.getByText(
            "Create the backup under Encrypted backup, with a passphrase you can remember.",
          ),
        ).toBeVisible();
        await expect(
          page.getByText(
            "Restore it there with the same passphrase. Matching items are overwritten, new ones are added, and nothing is deleted.",
          ),
        ).toBeVisible();
        await expect(
          page.getByRole("button", { name: "Walk me through" }),
        ).toBeVisible();
        await expect(
          page.getByRole("button", { name: "Show tutorial" }),
        ).toHaveCount(2);
      },
    );
  });
});
