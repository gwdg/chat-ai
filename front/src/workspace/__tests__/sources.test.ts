import { describe, expect, it } from "vitest";

import { visibleStorageSources } from "../sources";

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
