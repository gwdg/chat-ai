import { describe, expect, it } from "vitest";

import { mergeMessageHistory } from "../agentSessions";

const message = (id, extra = {}) => ({ id, type: "user", text: id, ...extra });

describe("mergeMessageHistory", () => {
  it("uses the downloaded history when nothing is cached", () => {
    const fetched = [message("a"), message("b")];
    const merged = mergeMessageHistory([], fetched, null);
    expect(merged.messages).toEqual(fetched);
    expect(merged.replace).toBe(true);
  });

  it("keeps the cached prefix and replaces the anchor with the new tail", () => {
    const cached = [message("a"), message("b"), message("c")];
    const fetched = [message("c", { text: "c updated" }), message("d")];

    const merged = mergeMessageHistory(cached, fetched, "c");

    expect(merged.messages.map((item) => item.id)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
    expect(merged.messages[2].text).toBe("c updated");
    expect(merged.changed.map((item) => item.id)).toEqual(["c", "d"]);
    expect(merged.startIndex).toBe(2);
    expect(merged.replace).toBe(false);
  });

  it("replaces the cache when the anchor is gone", () => {
    const cached = [message("a"), message("b")];
    const fetched = [message("x"), message("y")];

    const merged = mergeMessageHistory(cached, fetched, "b");

    expect(merged.messages).toEqual(fetched);
    expect(merged.replace).toBe(true);
  });

  it("appends a new tail when a gap is larger than the page window", () => {
    const cached = [message("a"), message("b")];
    const fetched = [message("x"), message("y")];

    const merged = mergeMessageHistory(cached, fetched, "b", false);

    expect(merged.messages.map((item) => item.id)).toEqual([
      "a",
      "b",
      "x",
      "y",
    ]);
    expect(merged.startIndex).toBe(2);
    expect(merged.replace).toBe(false);
  });

  it("leaves the cache alone when the server returned nothing yet", () => {
    const cached = [message("a")];
    const merged = mergeMessageHistory(cached, [], null);
    expect(merged.messages).toEqual(cached);
    expect(merged.replace).toBe(false);
  });
});
