import { describe, expect, it } from "vitest";
import { visibleWorkspaceSources } from "../workspaceSources";

const source = (id: string, kind: string, agentId?: string) =>
  ({
    id,
    kind,
    label: id,
    config: agentId ? { agentId } : {},
  }) as any;

describe("visibleWorkspaceSources", () => {
  it("hides agent filesystem sources for attached agents", () => {
    const visible = visibleWorkspaceSources(
      [
        source("browser", "browser"),
        source("attached", "agent", "agent-1"),
        source("bridged", "agent", "agent-2"),
        source("arcana", "arcana-filesystem"),
      ],
      [{ id: "agent-1" }],
    );

    expect(visible.map((item) => item.id)).toEqual([
      "browser",
      "bridged",
      "arcana",
    ]);
  });

  it("keeps sources that do not name an agent", () => {
    const visible = visibleWorkspaceSources(
      [source("unknown", "agent")],
      [{ id: "agent-1" }],
    );

    expect(visible).toHaveLength(1);
  });
});
