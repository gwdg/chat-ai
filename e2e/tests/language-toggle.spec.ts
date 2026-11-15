import { expect, openApp, test } from "./fixtures";

test.describe("language", () => {
  test("switches the interface to German", async ({ page, doc }) => {
    await doc.step(
      "Open the app in English",
      {
        user: "The user opens Chat AI with the default English interface.",
        system: "Footer and interface labels are English.",
      },
      () => openApp(page),
    );

    await doc.step(
      "Switch the language",
      {
        user: "The user clicks the German flag in the footer.",
        system:
          "The interface language changes immediately: legal links and helper texts are now German, without a reload.",
      },
      async () => {
        await page.locator('button:has(img[alt="de language flag"])').click();

        await expect(
          page.getByText("Impressum", { exact: true }),
        ).toBeVisible();
        await expect(
          page.getByText("niemals auf unseren Servern gespeichert", {
            exact: false,
          }),
        ).toBeVisible();
      },
    );
  });
});
