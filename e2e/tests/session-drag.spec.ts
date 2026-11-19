import { expect, openApp, openSidebar, test } from "./fixtures";
import type { Page } from "@playwright/test";

/**
 * Drag an agent session from the sidebar's Agents section onto a workspace row,
 * then fold the workspace with a double click. Both actions touch the same row,
 * so they share one scenario and one app instance.
 *
 * The agent is seeded into localStorage instead of being created through the
 * dialog: the test is about the sidebar, not about the add-agent flow, and the
 * mocked OpenCode server only has to answer the session listing.
 */

const AGENT_ID = "agent-drag";
const SESSION_ID = "ses_drag";

const SESSION = {
  id: SESSION_ID,
  title: "Draggable session",
  time: { created: 1_700_000_000_000, updated: 1_700_000_100_000 },
};

const AGENT = {
  id: AGENT_ID,
  name: "Drag agent",
  serverUrl: "http://127.0.0.1:4096",
  username: "opencode",
  passwordSource: "default",
  sessionId: SESSION_ID,
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
};

/** Minimal OpenCode server for the session list the sidebar reads. */
async function mockOpenCode(page: Page): Promise<void> {
  await page.route("http://127.0.0.1:4096/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (path === "/api/session" && request.method() === "GET") {
      await route.fulfill({ json: [SESSION] });
      return;
    }
    if (path === "/api/info") {
      await route.fulfill({ json: { version: "e2e" } });
      return;
    }
    if (path === "/api/global/health") {
      await route.fulfill({ json: { healthy: true } });
      return;
    }

    await route.fulfill({ json: [] });
  });
}

/** Rows as they are stored in IndexedDB (Dexie table `workspace_agent_sessions`). */
async function workspaceSessionLinks(page: Page): Promise<
  Array<{ workspaceId: string; agentId: string; sessionId: string }>
> {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open("app-conversations-db");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const store = db
            .transaction("workspace_agent_sessions", "readonly")
            .objectStore("workspace_agent_sessions");
          const all = store.getAll();
          all.onsuccess = () => resolve(all.result);
          all.onerror = () => reject(all.error);
        };
      }),
  );
}

async function workspaceIdFromUrl(page: Page): Promise<string> {
  const match = new URL(page.url()).pathname.match(/\/workspace\/([^/]+)/);
  if (!match) throw new Error(`not on a workspace page: ${page.url()}`);
  return decodeURIComponent(match[1]);
}

async function createWorkspace(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: "New workspace" }).click();
  await page.getByPlaceholder("e.g. Research").fill(name);
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await expect(page).toHaveURL(/\/workspace\/[^/]+$/);
}

test.describe("agent sessions in the sidebar", () => {
  test("drags a session onto a workspace and folds it with a double click", async ({
    page,
  }) => {
    await page.addInitScript(
      ({ agent }) => {
        localStorage.setItem("chatai.agents", JSON.stringify([agent]));
        // The Agents section is hidden until advanced mode is on. Seed the
        // persisted Redux slice instead of walking the profile modal: the test
        // is about the sidebar, and every setting keeps its default.
        localStorage.setItem(
          "persist:root",
          JSON.stringify({
            user_settings: JSON.stringify({ advanced_mode: true }),
            _persist: JSON.stringify({ version: 10, reflushed: true }),
          }),
        );
      },
      { agent: AGENT },
    );
    await mockOpenCode(page);

    await openApp(page);
    await openSidebar(page);
    await createWorkspace(page, "Drop target");
    const workspaceId = await workspaceIdFromUrl(page);

    // The agent's sessions are collapsed by default; the toggle is an icon
    // button whose accessible name is "Sessions".
    await page.getByRole("button", { name: "Sessions", exact: true }).click();
    const sessionRow = page.getByText("Draggable session", { exact: true });
    await expect(sessionRow).toBeVisible();

    // The row is a draggable div around the title button, exactly as the user
    // grabs it.
    const draggableRow = sessionRow.locator("xpath=ancestor::*[@draggable][1]");
    await expect(draggableRow).toHaveAttribute("draggable", "true");

    const workspaceRow = page
      .locator('[data-guide="workspace-row"]')
      .filter({ hasText: "Drop target" })
      .first();
    await expect(workspaceRow).toBeVisible();

    await draggableRow.dragTo(workspaceRow);

    await expect
      .poll(() => workspaceSessionLinks(page))
      .toContainEqual(
        expect.objectContaining({
          workspaceId,
          agentId: AGENT_ID,
          sessionId: SESSION_ID,
        }),
      );
    await expect(
      page.getByText("Could not attach the session to the workspace"),
    ).toHaveCount(0);

    // The workspace group now lists the agent and, already expanded, the
    // session the drop attached. The row element is only the header; its body
    // is the sibling under the same group.
    const workspaceGroup = workspaceRow.locator("xpath=..");
    await expect(
      workspaceGroup.getByText("Drag agent", { exact: true }),
    ).toBeVisible();
    await expect(
      workspaceGroup.getByText("Draggable session", { exact: true }),
    ).toBeVisible();
    await expect(
      workspaceGroup.getByText("Draggable session", { exact: true }),
    ).toBeVisible();

    // Double-clicking the workspace name folds the row instead of navigating.
    const name = workspaceRow.getByText("Drop target", { exact: true });
    await name.dblclick();
    await expect(page).toHaveURL(/\/workspace\/[^/]+$/);
    await expect(
      workspaceRow.getByRole("button", {
        name: "Attached chats, agents and sessions",
      }),
    ).toHaveAttribute("aria-expanded", "false");
    await expect(
      workspaceGroup.getByText("Draggable session", { exact: true }),
    ).toBeHidden();
  });

  test("folds a topic from a double click on its name", async ({ page }) => {
    await openApp(page);
    await openSidebar(page);

    await page.locator('[data-guide="create-topic"]').click();
    const input = page.locator('[data-guide="topic-create-input"]');
    await input.fill("Fold topic");
    await page.getByRole("button", { name: "Create", exact: true }).click();

    const label = page.getByText("Fold topic", { exact: true });
    await expect(label).toBeVisible();
    const row = label.locator('xpath=ancestor::*[@role="button"][1]');
    await expect(
      row.getByRole("button", { name: "Collapse topic" }),
    ).toHaveAttribute("aria-expanded", "true");

    const urlBefore = page.url();
    await label.dblclick();

    // The delayed single click is cancelled: no topic page opens.
    await expect(page).not.toHaveURL(/\/topic\//);
    expect(page.url()).toBe(urlBefore);
    await expect(
      row.getByRole("button", { name: "Expand topic" }),
    ).toHaveAttribute("aria-expanded", "false");
  });
});
