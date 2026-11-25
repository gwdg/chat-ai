import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  createConversation,
  createFolder,
  db,
  useConversationList,
  useFolderList,
} from "../index";
import { createWorkspace, useWorkspaceList } from "../workspaceDb";

const settings = {
  model: { id: "test-model", name: "Test Model" },
  temperature: 0.5,
  top_p: 0.5,
  tools: {},
};

/**
 * Every page mounts its own sidebar, so a topic or workspace page starts a new
 * list. `useLiveQuery` answers asynchronously, and an empty default made the
 * sidebar paint an empty list for the first frames of that page swap, which is
 * the flash the user saw. The hooks therefore default to the previous snapshot.
 */
describe("list snapshot defaults", () => {
  it("paints the previous conversations before the query answers", async () => {
    await createConversation({ title: "Snapshot chat", settings });

    const first = renderHook(() => useConversationList());
    await waitFor(() =>
      expect(first.result.current.map((row) => row.title)).toContain(
        "Snapshot chat",
      ),
    );
    first.unmount();

    // A remounted sidebar: the very first render must already hold the rows.
    const second = renderHook(() => useConversationList());
    expect(second.result.current.map((row) => row.title)).toContain(
      "Snapshot chat",
    );
  });

  it("paints the previous topics and still follows the live query", async () => {
    const folderId = await createFolder("Snapshot topic");

    const first = renderHook(() => useFolderList());
    await waitFor(() =>
      expect(first.result.current.map((row) => row.name)).toContain(
        "Snapshot topic",
      ),
    );
    first.unmount();

    const second = renderHook(() => useFolderList());
    expect(second.result.current.map((row) => row.name)).toContain(
      "Snapshot topic",
    );

    // The snapshot is only the default, not a cache that hides changes.
    await db.folders.update(folderId, { name: "Renamed topic" });
    await waitFor(() =>
      expect(second.result.current.map((row) => row.name)).toEqual([
        "Renamed topic",
      ]),
    );
  });

  it("paints the previous workspaces before the query answers", async () => {
    await createWorkspace("Snapshot workspace");

    const first = renderHook(() => useWorkspaceList());
    await waitFor(() =>
      expect(first.result.current.map((row) => row.name)).toContain(
        "Snapshot workspace",
      ),
    );
    first.unmount();

    const second = renderHook(() => useWorkspaceList());
    expect(second.result.current.map((row) => row.name)).toContain(
      "Snapshot workspace",
    );
  });
});
