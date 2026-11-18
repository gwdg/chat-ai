import { describe, expect, it } from "vitest";

import {
  modelKeyName,
  parseModelTokens,
  resolveModelTokens,
} from "../modelBindings";

const models = [
  { id: "qwen3-235b-a22b", name: "Qwen 3 235B" },
  { id: "mistral-large", name: "Mistral Large" },
  { id: "llama-4", name: "Llama 4" },
  { id: "llama-4-twin", name: "Llama 4" },
];

describe("parseModelTokens", () => {
  it("splits on commas, semicolons and newlines", () => {
    expect(parseModelTokens(" a, b; c\n d ,, ")).toEqual(["a", "b", "c", "d"]);
  });

  it("returns an empty list for blank input", () => {
    expect(parseModelTokens("")).toEqual([]);
    expect(parseModelTokens(null)).toEqual([]);
    expect(parseModelTokens(" , ; \n ")).toEqual([]);
  });
});

describe("resolveModelTokens", () => {
  it("matches exact ids and case-insensitive names", () => {
    const { matched, unknown } = resolveModelTokens(models, [
      "qwen3-235b-a22b",
      "mistral large",
    ]);
    expect(matched.map((model) => model.id)).toEqual([
      "qwen3-235b-a22b",
      "mistral-large",
    ]);
    expect(unknown).toEqual([]);
  });

  it("deduplicates a model listed twice and keeps input order", () => {
    const { matched } = resolveModelTokens(models, [
      "Llama 4",
      "qwen3-235b-a22b",
      "qwen3-235b-a22b",
    ]);
    // "Llama 4" is shared by two models, so both bind; the second id is skipped.
    expect(matched.map((model) => model.id)).toEqual([
      "llama-4",
      "llama-4-twin",
      "qwen3-235b-a22b",
    ]);
  });

  it("reports unknown tokens instead of dropping them silently", () => {
    const { matched, unknown } = resolveModelTokens(models, [
      "Qwen 3 235B",
      "not-a-model",
      "also-missing",
    ]);
    expect(matched.map((model) => model.id)).toEqual(["qwen3-235b-a22b"]);
    expect(unknown).toEqual(["not-a-model", "also-missing"]);
  });

  it("ignores empty entries and a missing model list", () => {
    expect(resolveModelTokens(undefined, ["x"])).toEqual({
      matched: [],
      unknown: ["x"],
    });
    expect(resolveModelTokens(models, ["", null])).toEqual({
      matched: [],
      unknown: [],
    });
  });
});

describe("modelKeyName", () => {
  it("joins display names and falls back to ids", () => {
    expect(
      modelKeyName([
        { id: "a", name: "Model A" },
        { id: "b", name: "" },
      ]),
    ).toBe("Model A, b");
    expect(modelKeyName([])).toBe("");
  });
});
