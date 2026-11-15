import { dismissWelcome, expect, openApp, test } from "./fixtures";

test.describe("theme", () => {
  test("toggles dark mode and keeps it after a reload", async ({
    page,
    doc,
  }) => {
    const html = page.locator("html");

    await doc.step(
      "Open the app in light mode",
      {
        user: "The user opens Chat AI with the default light theme.",
        system: "The page root has no dark class, so the light palette is used.",
        shows:
          "the Chat AI interface in a light colour scheme with the conversation area and prompt input",
      },
      async () => {
        await openApp(page);
        await expect(html).not.toHaveClass(/dark/);
      },
    );

    await doc.step(
      "Switch to dark mode",
      {
        user: "The user clicks the theme toggle in the footer.",
        system:
          "The dark class is applied to the page root and the daisyUI palette switches to the dark colours.",
        shows:
          "the Chat AI interface in a dark colour scheme with the conversation area and prompt input",
      },
      async () => {
        await page.locator('[data-guide="theme-toggle"]').click();
        await expect(html).toHaveClass(/dark/);
      },
    );

    await doc.step(
      "Reload and keep dark mode",
      {
        user: "The user reloads the page.",
        system:
          "The theme preference comes from the persisted Redux interface settings, so the page stays dark.",
        shows:
          "the Chat AI interface still in a dark colour scheme after a page reload",
      },
      async () => {
        await page.reload();
        await dismissWelcome(page);
        await expect(html).toHaveClass(/dark/);
      },
    );

    await doc.step(
      "Switch back to light mode",
      {
        user: "The user clicks the theme toggle again.",
        system: "The dark class is removed and the light palette is restored.",
        shows:
          "the Chat AI interface back in a light colour scheme",
      },
      async () => {
        await page.locator('[data-guide="theme-toggle"]').click();
        await expect(html).not.toHaveClass(/dark/);
      },
    );
  });
});
