import { describe, expect, it } from "vitest";
import { parseWorkspaceManifest } from "../workspaceManifest";

const valid = {
  schemaVersion: 1,
  workspace: { name: "Example", icon: "rocket", color: "#009EE0" },
  agent: {
    name: "Agent",
    sessionTitle: "Session",
    model: "model-id",
    bridgeWritable: true,
  },
  chats: [
    {
      title: "Chat",
      folderName: "Guides",
      settings: { temperature: 0.5 },
      messages: [
        { role: "system", content: "System" },
        { role: "user", content: "Question" },
        { role: "assistant", content: "Answer" },
      ],
    },
  ],
};

describe("parseWorkspaceManifest", () => {
  it("accepts a valid manifest", () => {
    const result = parseWorkspaceManifest(JSON.stringify(valid));
    expect(result.schemaVersion).toBe(1);
    expect(result.workspace.name).toBe("Example");
    expect(result.agent.name).toBe("Agent");
    expect(result.chats[0].messages).toHaveLength(3);
  });

  it("rejects unknown top-level keys", () => {
    expect(() =>
      parseWorkspaceManifest(
        JSON.stringify({ ...valid, command: "rm -rf /" }),
      ),
    ).toThrow(/unknown top-level key/);
  });

  it("rejects credential fields in chats", () => {
    expect(() =>
      parseWorkspaceManifest(
        JSON.stringify({
          ...valid,
          chats: [{ ...valid.chats[0], user_settings: {} }],
        }),
      ),
    ).toThrow(/not allowed/);
  });

  it("rejects invalid colours", () => {
    expect(() =>
      parseWorkspaceManifest(
        JSON.stringify({
          ...valid,
          workspace: { ...valid.workspace, color: "red" },
        }),
      ),
    ).toThrow(/six-digit hex/);
  });

  it("carries the bridge options of the agent", () => {
    // The bridge options decide what the agent may touch, so a manifest may set them the
    // same way the popover does. A value that is not a boolean is dropped instead of
    // guessed, so the popover keeps its own default.
    const result = parseWorkspaceManifest(
      JSON.stringify({
        ...valid,
        agent: {
          ...valid.agent,
          bridgeMcp: true,
          bridgeInjectExternal: true,
        },
      }),
    );
    expect(result.agent.bridgeWritable).toBe(true);
    expect(result.agent.bridgeMcp).toBe(true);
    expect(result.agent.bridgeInjectExternal).toBe(true);

    const withoutFlag = parseWorkspaceManifest(
      JSON.stringify({
        ...valid,
        agent: { ...valid.agent, bridgeInjectExternal: "yes" },
      }),
    );
    expect(withoutFlag.agent.bridgeInjectExternal).toBeUndefined();
  });
});
