import { expect, openApp, startTutorial, test } from "./fixtures";

test.describe("tutorial: search chats", () => {
  test("completes the gated two-step guide", async ({ page, doc }) => {
    let panel = page.locator("div[data-guide-keep-open]");

    await doc.step(
      "Start the Search chats tutorial",
      {
        user: "The user opens the Meta chat and starts the “Search chats” tutorial.",
        system:
          "The tutorial panel appears with Step 1 of 2 and tells the user to open the chat search.",
        shows: "the Meta chat with a tutorial panel showing Step 1 of 2",
      },
      async () => {
        await openApp(page, "/meta");
        panel = await startTutorial(page, "Search chats");
        await expect(panel).toContainText("Step 1 of 2");
      },
    );

    await doc.step(
      "Open the chat search",
      {
        user: "The user clicks the Search button in the sidebar.",
        system:
          "The search field opens, and the guide advances to Step 2 of 2, which waits for the user to type a query.",
        shows:
          "the sidebar with the chat search field open and a tutorial panel showing Step 2 of 2",
      },
      async () => {
        await page.locator('[data-guide="search-chats"]').click();

        await expect(panel).toContainText("Step 2 of 2");
        const search = page.locator('[data-guide="search-input"]');
        await expect(search).toBeVisible();
        await expect(panel).toContainText(
          "Waiting for you to complete this step",
        );
      },
    );

    await doc.step(
      "Type a query and finish the tutorial",
      {
        user: "The user types “hello” into the search field.",
        system:
          "The guide marks itself complete, and Done closes the tutorial panel.",
        shows:
          "the sidebar with the chat search field containing hello and the message No matches for \"hello\" below it",
      },
      async () => {
        const search = page.locator('[data-guide="search-input"]');
        await search.fill("hello");

        await expect(panel).toContainText("Tutorial complete", {
          timeout: 15_000,
        });
        await panel.getByRole("button", { name: "Done" }).click();
        await expect(panel).toHaveCount(0);
      },
    );
  });
});
