import { describe, expect, it, vi } from "vitest";

// A deployment (GAIA) that switched the memories feature off. The Meta chat must
// neither offer the memory tool nor turn a memory marker into a proposal.
vi.mock("../../config/deployment", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isFeatureEnabled: (name) =>
      name === "memories" ? false : actual.isFeatureEnabled(name),
  };
});

import { getMetaActionProposals } from "../metaActions";
import { getMetaToolDefinitions } from "../metaTools";

describe("Meta chat without the memories feature", () => {
  it("omits list_memories from the tool definitions", () => {
    const names = getMetaToolDefinitions(true).map(
      (definition) => definition.function.name,
    );
    expect(names).not.toContain("list_memories");
  });

  it("drops every memory proposal but keeps unrelated settings", () => {
    const proposals = getMetaActionProposals(
      [
        '[[ADD_MEMORY:{"text":"remember this"}]]',
        '[[UPDATE_MEMORY:{"index":0,"text":"changed"}]]',
        '[[DELETE_MEMORY:{"index":1}]]',
        '[[CLEAR_MEMORIES]]',
        '[[SET_SETTING:{"key":"memory_mode","value":1}]]',
        '[[SET_CONVERSATION_SETTING:{"target":"all","key":"memory_mode_override","value":1}]]',
        '[[SET_SETTING:{"key":"render_typst","value":true}]]',
      ].join("\n"),
    );

    expect(proposals).toHaveLength(1);
    expect(proposals[0]).toMatchObject({
      type: "setting",
      key: "render_typst",
      value: true,
    });
  });
});
