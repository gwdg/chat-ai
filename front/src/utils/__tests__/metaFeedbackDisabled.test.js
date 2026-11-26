import { describe, expect, it, vi } from "vitest";

// A deployment whose feedback module is off (the module is opt-in outside
// GAIA). The Meta chat must not propose a transcript mode it cannot use.
vi.mock("../../config/deployment", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isFeatureEnabled: (name) =>
      name === "feedback" ? false : actual.isFeatureEnabled(name),
  };
});

import { getMetaActionProposals } from "../metaActions";

describe("Meta chat without the feedback module", () => {
  it("drops the transcript preference but keeps unrelated settings", () => {
    const proposals = getMetaActionProposals(
      [
        '[[SET_SETTING:{"key":"feedback_send_transcripts","value":false}]]',
        '[[SET_SETTING:{"key":"render_typst","value":true}]]',
      ].join("\n"),
    );

    expect(proposals).toEqual([
      { type: "setting", key: "render_typst", value: true },
    ]);
  });
});
