import { describe, expect, it } from "vitest";

import { sourceRowActions, visibleStorageSources } from "../sources";

const source = (id: string, kind: string) =>
  ({ id, kind, label: id, workspaceId: "ws" }) as any;

describe("visibleStorageSources", () => {
  it("leaves the derived chat storage sources out of the list", () => {
    const sources = [
      source("browser", "browser"),
      source("chat-1", "chat"),
      source("arcana", "arcana-filesystem"),
      source("agent", "agent"),
    ];

    expect(visibleStorageSources(sources).map((entry) => entry.id)).toEqual([
      "browser",
      "arcana",
      "agent",
    ]);
  });
});

describe("sourceRowActions", () => {
  const actions = (kind: string, readOnly = false) =>
    sourceRowActions({ kind, readOnly } as any);

  it("offers every action on storage the user added", () => {
    for (const kind of ["local", "mcp", "arcana", "arcana-filesystem"]) {
      expect(actions(kind)).toEqual({
        addFolder: true,
        toggleReadOnly: true,
        remove: true,
      });
    }
  });

  it("offers no add-folder, read-only or remove action on the browser source", () => {
    // Its tree is the workspace root: it is created with the workspace and never recreated, its
    // folders already sit at the root, and its read-only flag does not reach the root provider.
    expect(actions("browser")).toEqual({
      addFolder: false,
      toggleReadOnly: false,
      remove: false,
    });
  });

  it("keeps the read-only toggle when a browser row is already read-only", () => {
    // Such a row can only come from before the rule, and without the toggle its writes would be
    // blocked with no way back.
    expect(actions("browser", true)).toEqual({
      addFolder: false,
      toggleReadOnly: true,
      remove: false,
    });
  });

  it("offers no remove or read-only action on derived sources", () => {
    expect(actions("chat")).toEqual({
      addFolder: false,
      toggleReadOnly: false,
      remove: false,
    });
    // An agent's files can still be mounted into the workspace.
    expect(actions("agent")).toEqual({
      addFolder: true,
      toggleReadOnly: false,
      remove: false,
    });
  });
});
