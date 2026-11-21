import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  model: "gemma-4-31b-it",
  getModelsData: vi.fn(async () => [{ id: "gemma-4-31b-it" }]),
}));

vi.mock("../agentEndpoints", () => ({
  EXPLAIN_IMAGE_MODEL: () => mocks.model,
}));

vi.mock("../getModelsData", () => ({
  getModelsData: (...args) => mocks.getModelsData(...args),
}));

import {
  isVisionModelAvailable,
  resetVisionModelCache,
} from "../visionModel";

describe("isVisionModelAvailable", () => {
  beforeEach(() => {
    resetVisionModelCache();
    mocks.model = "gemma-4-31b-it";
    mocks.getModelsData.mockReset();
    mocks.getModelsData.mockResolvedValue([{ id: "gemma-4-31b-it" }]);
  });

  it("answers true when the deployment lists the vision model", async () => {
    await expect(isVisionModelAvailable()).resolves.toBe(true);
  });

  it("answers false when the model list does not contain it", async () => {
    mocks.getModelsData.mockResolvedValue([{ id: "some-chat-model" }]);

    await expect(isVisionModelAvailable()).resolves.toBe(false);
  });

  it("shares the fetched list between previews", async () => {
    await isVisionModelAvailable();
    await isVisionModelAvailable();

    expect(mocks.getModelsData).toHaveBeenCalledTimes(1);
  });

  // A transient failure says nothing about the deployment, so the next image asks
  // again instead of staying greyed out for the whole session.
  it("does not cache a failed lookup", async () => {
    mocks.getModelsData.mockRejectedValueOnce(new Error("offline"));
    await expect(isVisionModelAvailable()).resolves.toBe(false);

    mocks.getModelsData.mockResolvedValue([{ id: "gemma-4-31b-it" }]);
    await expect(isVisionModelAvailable()).resolves.toBe(true);
    expect(mocks.getModelsData).toHaveBeenCalledTimes(2);
  });

  it("does not fetch at all when no vision model is configured", async () => {
    mocks.model = "";

    await expect(isVisionModelAvailable()).resolves.toBe(false);
    expect(mocks.getModelsData).not.toHaveBeenCalled();
  });
});
