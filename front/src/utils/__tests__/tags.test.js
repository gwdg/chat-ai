import { describe, expect, it } from "vitest";

import { normalizeTagList } from "../tags";

describe("normalizeTagList", () => {
  it("trims a list and drops empty entries", () => {
    expect(normalizeTagList([" alpha ", "", "beta", "  "])).toEqual([
      "alpha",
      "beta",
    ]);
  });

  it("drops a repeated tag regardless of case", () => {
    // The service's filter is an AND over distinct tags; the duplicate would
    // only narrow the same set again.
    expect(normalizeTagList(["Alpha", "alpha", "ALPHA"])).toEqual(["Alpha"]);
  });

  it("accepts one comma-separated string", () => {
    expect(normalizeTagList(" alpha, beta ,, gamma ")).toEqual([
      "alpha",
      "beta",
      "gamma",
    ]);
  });

  it("reads an absent or malformed argument as no filter", () => {
    expect(normalizeTagList(undefined)).toEqual([]);
    expect(normalizeTagList(null)).toEqual([]);
    expect(normalizeTagList(42)).toEqual([]);
    expect(normalizeTagList({ tags: ["alpha"] })).toEqual([]);
  });
});
