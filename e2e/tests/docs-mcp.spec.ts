import { mockMcpServer, useDocumentationModels } from "./docs-capture";
import { expect, openApp, seedUserSettings, test } from "./fixtures";

// Screenshots for the user documentation: the MCP server dialog and a
// configured server. The handshake is mocked, so the status light turns green
// without a real server.

test("configures an MCP server and connects to it", async ({
  page,
  context,
  doc,
}) => {
  await seedUserSettings(context, { advanced_mode: true });
  await useDocumentationModels(page);
  await mockMcpServer(page);

  await doc.step(
    "Open the MCP Servers section",
    {
      user: "The user opens the MCP Servers section in the sidebar.",
      system: "The section lists the configured servers and offers to add one.",
      shows: "the sidebar MCP Servers section without a configured server",
    },
    async () => {
      await openApp(page);
      // The capture is about MCP servers, so fold the unrelated Arcanas
      // section instead of showing that this deployment has no RAG service.
      await page
        .locator('[data-guide="arcanas"] button[aria-expanded="true"]')
        .click();
      // Leave the header's tooltip behind before the screenshot.
      await page.mouse.move(900, 600);
      await expect(page.locator('[data-guide="mcp-servers-add"]')).toBeVisible();
    },
  );

  await doc.step(
    "Enter a server",
    {
      user: "The user adds a name and the server URL.",
      system:
        "The dialog keeps the URL and offers to test the connection before saving.",
      shows:
        "the Add MCP server dialog with the name DeepWiki and the URL https://mcp.deepwiki.com/mcp",
    },
    async () => {
      await page.locator('[data-guide="mcp-servers-add"]').click();
      await page.getByPlaceholder("My file server").fill("DeepWiki");
      await page
        .getByPlaceholder("http://localhost:3000/mcp")
        .fill("https://mcp.deepwiki.com/mcp");
      await expect(
        page.getByRole("button", { name: "Test connection" }),
      ).toBeEnabled();
    },
  );

  await doc.step(
    "Test the connection and save",
    {
      user: "The user tests the connection and saves the server.",
      system:
        "The server answers with its name and tool count, and the sidebar lists it with a green status light.",
      shows: "the MCP Servers section with DeepWiki listed as connected",
    },
    async () => {
      await page.getByRole("button", { name: "Test connection" }).click();
      await expect(
        page.getByText(/DeepWiki is reachable \(2 tools\)\./),
      ).toBeVisible({ timeout: 15_000 });
      await page.getByRole("button", { name: "Save" }).click();
      const row = page
        .locator('[data-guide="mcp-server-details"]')
        .filter({ hasText: "DeepWiki" })
        .first();
      await expect(row).toBeVisible({ timeout: 10_000 });
      await expect(
        row.getByLabel("DeepWiki: Connected", { exact: true }),
      ).toBeVisible();
    },
  );
});
