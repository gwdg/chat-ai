import { describe, expect, it } from "vitest";

import { modelSupportsReasoning } from "../modelCapabilities";

describe("modelSupportsReasoning", () => {
  it("trusts the models endpoint when it lists the thought output", () => {
    expect(
      modelSupportsReasoning({ id: "unknown", output: ["text", "thought"] }),
    ).toBe(true);
  });

  it("uses the model config when the endpoint does not list thought", () => {
    // gemma-4-31b-it has a reasoning setting (none/on) but no thought output.
    expect(
      modelSupportsReasoning({ id: "gemma-4-31b-it", output: ["text"] }),
    ).toBe(true);
  });

  it("is false when neither source declares reasoning", () => {
    expect(modelSupportsReasoning({ id: "unknown", output: ["text"] })).toBe(
      false,
    );
    expect(modelSupportsReasoning(undefined)).toBe(false);
  });
});
