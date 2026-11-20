import type { Page } from "@playwright/test";

import { SAIA_FS_TARGET } from "../src/saiaFsTarget";
import { expect, openApp, openSidebar, test } from "./fixtures";

/**
 * Opt-in integration scenario: the workspace's "SAIA Files" drive against a real
 * saia-fs service.
 *
 * Chat AI normally reaches the filesystem at `<backendPath>/saia-fs`, a path only
 * a deployment hop can serve (`AGENTS.md` §4.31). Two ways to run this scenario:
 *
 *   E2E_SAIA_FS=1 npm run test:saia-fs
 *     the generated config sets `saiaFsEndpoint` to `E2E_SAIA_FS_URL` (default
 *     `http://127.0.0.1:8003`, where the local stack serves saia-fs) and sends
 *     the caller's identity as `x-auth-claim-uid`, because no hop stamps it.
 *     The browser talks to that instance directly.
 *
 *   E2E_SAIA_FS=1 E2E_SAIA_FS_EDGE=harness npm run test:saia-fs
 *     `scripts/saia-fs-edge.mjs` stands in for the deployment hop and the
 *     scenario runs the whole browser → edge → registry → saia-fs path, with the
 *     app on the `saiaFsEndpoint`-free `<backendPath>/saia-fs` route.
 *
 * Either way `/models`, `/user` and `/chat/completions` stay mocked, so no model
 * or API key is needed; only the filesystem traffic is real.
 */

const ENABLED = process.env.E2E_SAIA_FS === "1";
/** The identity the request carries (`x-auth-claim-uid`). */
const USER = SAIA_FS_TARGET.user;
/** The folder inside the account root the scenario mounts into the workspace. */
const ENTRY = SAIA_FS_TARGET.entry;
/** The base the app probes: `saiaFsEndpoint`, or `<backendPath>/saia-fs`. */
const BASE = SAIA_FS_TARGET.base;
const HEALTH_URL = `${BASE}/health`;

type Call = {
  method: string;
  url: string;
  status?: number;
  failure?: string;
  body?: string;
};

/** Record every request the app makes to the filesystem base. */
function recordTraffic(page: Page): Call[] {
  const calls: Call[] = [];
  page.on("request", (request) => {
    if (!request.url().startsWith(`${BASE}/`)) return;
    calls.push({ method: request.method(), url: request.url() });
  });
  page.on("response", async (response) => {
    const url = response.url();
    if (!url.startsWith(`${BASE}/`)) return;
    const call = calls.findLast((entry) => entry.url === url && entry.status === undefined);
    // Only the health answer is buffered here: the MCP exchange is streamed, and
    // reading it while the session is open would wait for the stream to end.
    const body = url === HEALTH_URL ? await response.text().catch(() => "") : undefined;
    if (call) {
      call.status = response.status();
      call.body = body;
    } else {
      calls.push({ method: response.request().method(), url, status: response.status(), body });
    }
  });
  page.on("requestfailed", (request) => {
    if (!request.url().startsWith(`${BASE}/`)) return;
    const call = calls.findLast((entry) => entry.url === request.url() && entry.status === undefined);
    const failure = request.failure()?.errorText ?? "failed";
    if (call) call.failure = failure;
    else calls.push({ method: request.method(), url: request.url(), failure });
  });
  return calls;
}

/**
 * Why the drive is missing: which URL the app probed, what it answered, and
 * whether a plain request from Node sees the same thing (a browser-side CORS
 * refusal looks different from a 404).
 */
async function diagnose(page: Page, calls: Call[]): Promise<string> {
  const lines = [
    "The SAIA Files drive did not appear in the create-workspace storage browser.",
  ];
  const health = calls.find((call) => call.url === HEALTH_URL);

  if (!calls.length) {
    lines.push(
      `The app never requested ${BASE} at all, so nothing could be probed. Check that the run really uses the saia-fs config (the SAIA filesystem endpoint Vite logs at startup) and that the workspace dialog mounted.`,
    );
  } else if (!health) {
    lines.push("The app requested saia-fs, but not its health probe:");
  } else {
    lines.push(
      `Probe: ${health.status ?? health.failure} ${health.method} ${health.url}`,
    );
    if (health.body) lines.push(`Answer: ${health.body}`);
    // Second opinion from Node: same URL, no browser CORS involved.
    try {
      const response = await fetch(health.url, {
        headers: { accept: "application/json", "x-auth-claim-uid": USER },
        signal: AbortSignal.timeout(10_000),
      });
      const body = (await response.text()).slice(0, 300);
      lines.push(`Repeat from Node: ${response.status} ${body}`);
    } catch (error) {
      lines.push(`Repeat from Node failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  lines.push(
    "",
    "Chat AI probes `saiaFsEndpoint` when the config sets it, otherwise `<backendPath>/saia-fs`. The deployment path needs a hop that forwards `/saia-fs/health` and `/saia-fs/mcp` to the SAIA registry and adds `x-auth-claim-uid`; a 404 there means that hop does not exist. Point E2E_SAIA_FS_URL at a bare instance, or run with E2E_SAIA_FS_EDGE=harness to use scripts/saia-fs-edge.mjs.",
    "",
    "Traffic:",
    ...(calls.length
      ? calls.map(
          (call) =>
            `  ${call.status ?? call.failure ?? "(open)"} ${call.method} ${call.url}`,
        )
      : ["  (none)"]),
  );
  return lines.join("\n");
}

const WORKSPACE_NAME = "SAIA filesystem";

test.describe("SAIA filesystem", () => {
  test.skip(
    !ENABLED,
    "set E2E_SAIA_FS=1 to run the saia-fs scenario (npm run test:saia-fs)",
  );

  test("browses and mounts the account folder from the real service", async ({
    page,
    doc,
  }) => {
    test.slow();

    // The storage browser only lives in the create-workspace dialog: the
    // workspace page itself is the chat list, and an existing workspace's
    // storage is reopened through the row's "Edit storage" entry. So the drive
    // is found and the folder mounted while the draft workspace exists, and the
    // last step proves the mount survived into the created workspace.
    const create = page.getByRole("dialog");
    const calls = recordTraffic(page);
    const drive = create.locator('[data-guide="workspace-source-saia-fs"]');
    const pane = create.locator('[data-guide="workspace-source-browser"]');
    const browserList = pane.locator('[data-guide="workspace-source-browser-list"]');

    await doc.step(
      "Open the app",
      {
        user: "The user opens Chat AI and reveals the sidebar.",
        system: "The workspace section is visible with a New workspace action.",
      },
      async () => {
        await openApp(page);
        await openSidebar(page);
      },
    );

    await doc.step(
      "Start a workspace",
      {
        user: "The user clicks New workspace and names it “SAIA filesystem”.",
        system:
          "The create-workspace dialog opens with its storage browser: a Sources rail on the left and the workspace root on the right.",
      },
      async () => {
        await page.getByRole("button", { name: "New workspace" }).click();
        await create.getByLabel("Workspace name").fill(WORKSPACE_NAME);
        await expect(create.locator('[data-guide="workspace-sources"]')).toBeVisible();
        await expect(create.locator('[data-guide="workspace-files"]')).toBeVisible();
      },
    );

    await doc.step(
      "Find the SAIA Files drive",
      {
        user: "The user looks at the Sources rail.",
        system:
          "A SAIA Files card appears next to the device, browser and Arcana drives because the service answered its health probe.",
      },
      async () => {
        try {
          await expect(drive).toBeVisible({ timeout: 25_000 });
        } catch {
          throw new Error(await diagnose(page, calls));
        }
        // The card carries a red exclamation when the source row exists but the
        // provider could not connect; that is a different failure than "no drive".
        const broken = drive.locator('[data-guide="workspace-source-broken"]');
        if (await broken.count()) {
          const reason =
            (await broken.first().getAttribute("aria-label")) ??
            "the source is marked as not working";
          throw new Error(
            `The SAIA Files drive is present but marked broken: ${reason}\n\n${await diagnose(page, calls)}`,
          );
        }
        const probe = calls.find((call) => call.url === HEALTH_URL);
        expect(probe?.status, await diagnose(page, calls)).toBe(200);
      },
    );

    await doc.step(
      "Open the account folder",
      {
        user: "The user opens the SAIA Files drive.",
        system:
          "The source pane lists the folders of the caller's account folder, answered by the real saia-fs service.",
      },
      async () => {
        await drive.click();
        await expect(browserList).toBeVisible();

        // Wait for the listing to settle: a row, or the explicit empty state.
        const emptyState = pane.getByText("Nothing here yet", { exact: true });
        await expect(
          pane.getByRole("checkbox").first().or(emptyState).first(),
        ).toBeVisible({ timeout: 30_000 });

        if ((await emptyState.count()) && (await emptyState.first().isVisible())) {
          throw new Error(
            `The service answered, but the caller's account folder is empty. saia-fs creates ` +
              `<root>/<uid> on first contact, so an empty folder means the request carried a ` +
              `different identity than the account that was seeded (E2E_SAIA_FS_USER=${USER}). ` +
              `Point E2E_SAIA_FS_ENTRY at a folder that account does hold.\n\n` +
              (await diagnose(page, calls)),
          );
        }

        const errorNode = browserList.locator(".text-error").first();
        if (await errorNode.count()) {
          const error = (await errorNode.textContent()) ?? "";
          throw new Error(
            `saia-fs answered the listing with an error: ${error.trim()}\n\n${await diagnose(page, calls)}`,
          );
        }

        if (ENTRY) {
          // The account folder of the local test user holds `local-testing`; a
          // different deployment can name its own with E2E_SAIA_FS_ENTRY.
          await expect(pane.getByRole("checkbox", { name: ENTRY })).toBeVisible({
            timeout: 15_000,
          });
        }
      },
    );

    if (ENTRY) {
      await doc.step(
        "Add the folder to the workspace",
        {
          user: "The user selects the account folder and clicks Add to Workspace.",
          system:
            "The folder appears in the workspace root, mounted rather than copied, so the workspace reads it through the same service.",
        },
        async () => {
          await pane.getByRole("checkbox", { name: ENTRY }).check();
          const add = create.locator('[data-guide="workspace-add-to-workspace"]');
          await expect(add).toBeEnabled({ timeout: 10_000 });
          await add.click();
          await expect(
            create
              .locator('[data-guide="workspace-files"]')
              .getByText(ENTRY, { exact: true })
              .first(),
          ).toBeVisible({ timeout: 30_000 });
        },
      );
    }

    await doc.step(
      "Keep the mount in the created workspace",
      {
        user: "The user clicks Create workspace, then reopens the workspace's storage from its menu.",
        system:
          "Edit storage shows the same workspace root, still holding the mounted account folder: the mount belongs to the stored workspace, not only to the dialog.",
      },
      async () => {
        await create
          .getByRole("button", { name: "Create workspace", exact: true })
          .click();
        await expect(page).toHaveURL(/\/workspace\/[^/]+$/);

        // The workspace page is the chat list now; its storage is the row's
        // "Edit storage" entry.
        await openSidebar(page);
        const row = page
          .getByRole("button", { name: WORKSPACE_NAME, exact: true })
          .first();
        await row.hover();
        await page.locator('[data-guide="workspace-menu"]').first().click();
        await page.locator('[data-guide="workspace-edit-storage"]').click();

        const storage = page
          .getByRole("dialog")
          .filter({ has: page.getByTestId("edit-workspace-storage-hint") });
        await expect(
          storage.locator('[data-guide="workspace-storage-tree"]'),
        ).toBeVisible();
        if (ENTRY) {
          await expect(
            storage
              .locator('[data-guide="workspace-files"]')
              .getByText(ENTRY, { exact: true })
              .first(),
          ).toBeVisible({ timeout: 30_000 });
        }
      },
    );
  });
});
