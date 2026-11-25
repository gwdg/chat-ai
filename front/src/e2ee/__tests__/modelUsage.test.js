import { describe, expect, it } from "vitest";

import { envDefaultModelId, internalModelUsage } from "../modelUsage";

describe("envDefaultModelId", () => {
  it("reads the default model from VITE_DEFAULT_SETTINGS", () => {
    expect(
      envDefaultModelId({
        VITE_DEFAULT_SETTINGS: JSON.stringify({ model: { id: "qwen" } }),
      }),
    ).toBe("qwen");
  });

  it("is empty when the setting is missing or unparsable", () => {
    expect(envDefaultModelId({})).toBe("");
    expect(envDefaultModelId({ VITE_DEFAULT_SETTINGS: "{not json" })).toBe("");
    expect(
      envDefaultModelId({ VITE_DEFAULT_SETTINGS: JSON.stringify({}) }),
    ).toBe("");
  });
});

describe("internalModelUsage", () => {
  it("falls titles, memory, proposals and summaries back to the default model", () => {
    const usage = internalModelUsage({
      VITE_DEFAULT_SETTINGS: JSON.stringify({ model: { id: "default-chat" } }),
      VITE_MODULE_CHOICES: "true",
    });

    expect(usage.get("default-chat")).toEqual([
      "titles",
      "memory",
      "proposals",
      "summaries",
    ]);
  });

  it("uses the dedicated generation models when configured", () => {
    const usage = internalModelUsage(
      {
        VITE_DEFAULT_SETTINGS: JSON.stringify({ model: { id: "default-chat" } }),
        VITE_TITLE_GENERATION_MODEL: "titles-model",
        VITE_MEMORY_GENERATION_MODEL: "memory-model",
        VITE_PROPOSAL_GENERATION_MODEL: "proposals-model",
        VITE_MODULE_CHOICES: "true",
        VITE_MODULE_AGENT: "true",
        VITE_EXPLAIN_IMAGE_MODEL: "vision-model",
      },
      { summaries: false },
    );

    expect(usage.get("titles-model")).toEqual(["titles"]);
    expect(usage.get("memory-model")).toEqual(["memory"]);
    expect(usage.get("proposals-model")).toEqual(["proposals"]);
    expect(usage.get("vision-model")).toEqual(["image_analysis"]);
    expect(usage.has("default-chat")).toBe(false);
  });

  it("hides proposal and vision usage while their modules are off", () => {
    const usage = internalModelUsage({
      VITE_PROPOSAL_GENERATION_MODEL: "proposals-model",
      VITE_EXPLAIN_IMAGE_MODEL: "vision-model",
      VITE_MODULE_CHOICES: "false",
      VITE_MODULE_AGENT: "false",
    });

    expect(usage.has("proposals-model")).toBe(false);
    expect(usage.has("vision-model")).toBe(false);
  });

  it("uses the user's default chat model for summaries", () => {
    const usage = internalModelUsage(
      {},
      { defaultModelId: "user-default", summaries: true },
    );
    expect(usage.get("user-default")).toEqual(["summaries"]);
  });

  it("does not add a summary model when summaries are off", () => {
    const usage = internalModelUsage(
      {},
      { defaultModelId: "user-default", summaries: false },
    );
    expect(usage.size).toBe(0);
  });

  it("falls the summary model back to the deployment and title model", () => {
    const envDefault = internalModelUsage({
      VITE_DEFAULT_SETTINGS: JSON.stringify({ model: { id: "env-default" } }),
    });
    expect(envDefault.get("env-default")).toContain("summaries");

    const titleFallback = internalModelUsage({
      VITE_TITLE_GENERATION_MODEL: "titles-model",
    });
    expect(titleFallback.get("titles-model")).toEqual([
      "titles",
      "summaries",
    ]);
  });

  it("defaults image analysis to the Gemma vision model", () => {
    const usage = internalModelUsage(
      { VITE_MODULE_AGENT: "true" },
      { summaries: false },
    );
    expect(usage.get("gemma-4-31b-it")).toEqual(["image_analysis"]);
  });

  it("returns an empty map without a deployment model", () => {
    expect(internalModelUsage({}).size).toBe(0);
    expect(
      internalModelUsage({}, { summaries: false }).size,
    ).toBe(0);
  });
});
