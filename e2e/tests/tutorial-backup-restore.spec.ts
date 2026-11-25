import {
  expect,
  openApp,
  showTutorialPanel,
  startTutorial,
  test,
} from "./fixtures";

/**
 * The restore guide is a settings tour: every step completes by clicking the
 * target it highlights, ending at the restore card in Data → Encrypted backup.
 * That makes it the regression test for the settings-modal path of the tour
 * runtime (`openUserSettings`, `selectSettingsTab`, `selectDataSection`).
 */
test.describe("tutorial: restore a backup", () => {
  test("walks the restore guide into the backup section", async ({
    page,
    doc,
  }) => {
    let panel = page.locator("div[data-guide-keep-open]");

    await doc.step(
      "Start the restore tutorial",
      {
        user: "The user opens the Meta chat and starts “Restore an encrypted backup”.",
        system:
          "The tutorial panel appears with Step 1 of 4 and points at the user settings button.",
        shows: "the Meta chat with a tutorial panel showing Step 1 of 4",
      },
      async () => {
        await openApp(page, "/meta");
        panel = await startTutorial(page, "Restore an encrypted backup");
        await expect(panel).toContainText("Step 1 of 4");
      },
    );

    await doc.step(
      "Open user settings",
      {
        user: "The user clicks the highlighted profile button.",
        system:
          "The settings dialog opens on the Profile tab and the guide advances to Step 2 of 4, which points at the Data tab.",
        shows: "the user settings dialog open over the Meta chat",
      },
      async () => {
        // The settings button lives in the sidebar: on phones and tablets the
        // guide opens the drawer, so reuse it rather than closing it.
        await showTutorialPanel(page);
        // Two copies exist: the collapsed rail's user button and the card in
        // the expanded panel, which covers the rail. The card is the last one.
        await page
          .locator('[data-guide="user-settings"]:visible')
          .last()
          .click();
        // The dialog root is a zero-size wrapper around fixed children, so
        // assert on its title instead of the container itself.
        await expect(
          page.getByText("User Profile Settings", { exact: true }),
        ).toBeVisible();
        await expect(panel).toContainText("Step 2 of 4");
      },
    );

    await doc.step(
      "Choose the Data tab",
      {
        user: "The user opens the Data tab.",
        system:
          "The Data tab shows its Manage data and Encrypted backup sections — server synchronization is off in this build — and the guide advances to Step 3 of 4.",
        shows:
          "the Data tab with the Manage data and Encrypted backup buttons",
      },
      async () => {
        await page.locator('[data-guide="settings-tab-data"]').click();
        await expect(panel).toContainText("Step 3 of 4");
      },
    );

    await doc.step(
      "Open Encrypted backup",
      {
        user: "The user switches to the Encrypted backup section.",
        system:
          "The section shows the create and restore cards, and the guide advances to Step 4 of 4, which points at the restore card.",
        shows:
          "the Encrypted backup section with the create and restore cards",
      },
      async () => {
        await page.locator('[data-guide="data-subtab-backup"]').click();
        await expect(page.locator('[data-guide="backup-create"]')).toBeVisible();
        await expect(panel).toContainText("Step 4 of 4");
      },
    );

    await doc.step(
      "Click the restore card",
      {
        user: "The user clicks the restore card.",
        system:
          "The card holds the file picker, the passphrase field, the confirmation switch and the Restore button, and the guide finishes.",
        shows:
          "the restore card with a file picker, a passphrase field and a Restore button",
      },
      async () => {
        await page.locator('[data-guide="backup-restore"]').click();
        await expect(panel).toContainText("Tutorial complete");
      },
    );

    // The settings dialog covers the sidebar panel, so its Done button is only
    // reachable once the dialog is closed. Escape would also dismiss the guide.
    await page.getByRole("button", { name: "Close dialog" }).click();
    await expect(page.getByText("User Profile Settings")).toHaveCount(0);
    await expect(panel).toContainText("Tutorial complete");
    await panel.getByRole("button", { name: "Done" }).click();
    await expect(panel).toHaveCount(0);
  });
});
