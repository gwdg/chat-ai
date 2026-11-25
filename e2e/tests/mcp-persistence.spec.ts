import { expect, openApp, seedUserSettings, test } from "./fixtures";

// The sidebar is docked from 1081 px up; below that it is a drawer, and the
// lists these scenarios use are only reachable in their docked form.
test.use({ video: "off", viewport: { width: 1440, height: 900 } });

// The MCP Servers section is an advanced-mode section and is hidden by default.
test.beforeEach(async ({ context }) => {
  await seedUserSettings(context, { advanced_mode: true });
});

async function addServer(page: import("@playwright/test").Page, name: string) {
  await page.getByRole("button", { name: "Add MCP server" }).first().click();
  await page.getByPlaceholder("My file server").fill(name);
  await page
    .getByPlaceholder("http://localhost:3000/mcp")
    .fill("http://127.0.0.1:9999/mcp");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(name)).toBeVisible();
}

test("a configured MCP server survives a reload", async ({ page, doc }) => {
  await doc.step(
    "Add an MCP server",
    {
      user: "The user adds an MCP server in the sidebar.",
      system: "The server is stored in the persisted user settings.",
      shows: "the MCP Servers section with one configured server",
    },
    async () => {
      await openApp(page);
      await addServer(page, "Persisted server");
    },
  );

  await doc.step(
    "Reload the page",
    {
      user: "The user reloads the page.",
      system: "The server comes back from localStorage.",
      shows: "the MCP Servers section still listing the configured server",
    },
    async () => {
      await page.reload();
      await expect(page.getByText("Persisted server")).toBeVisible();
    },
  );
});

test("an MCP server added in one tab is not lost when another tab saves", async ({
  page,
  context,
  doc,
}) => {
  await openApp(page);
  // The second tab is opened before the server exists, so its Redux state is stale.
  const other = await context.newPage();
  await openApp(other);
  await expect(other.getByText("Persisted server")).toHaveCount(0);

  await doc.step(
    "Add the server in the first tab",
    {
      user: "The user adds an MCP server in the first tab.",
      system:
        "The change is broadcast to the second tab, so that tab no longer holds a stale list.",
      shows:
        "the sidebar's MCP Servers section listing Persisted server with the address http://127.0.0.1:9999/mcp",
    },
    async () => {
      await addServer(page, "Persisted server");
    },
  );

  await doc.step(
    "Change a setting in the second tab",
    {
      user: "The user switches the theme in the second tab.",
      system:
        "Any action in the second tab re-persists its whole user settings, including the server.",
      shows: "the app rendered in dark mode with the sidebar visible",
    },
    async () => {
      await other.locator('[data-guide="theme-toggle"]').click();
      // The class on <body> is what actually paints the theme; waiting for it
      // also gives redux-persist the turn that writes the settings back.
      await expect(other.locator("body")).toHaveClass(/\bdark\b/);
    },
    // The step acts on the second tab, so the screenshot must come from it.
    { page: other },
  );

  await doc.step(
    "Reload the first tab",
    {
      user: "The user reloads the first tab.",
      system:
        "The server is still in the persisted settings because no tab wrote a stale copy back.",
      shows: "the MCP Servers section still listing the configured server",
    },
    async () => {
      await page.reload();
      await expect(page.getByText("Persisted server")).toBeVisible();
    },
  );
});
