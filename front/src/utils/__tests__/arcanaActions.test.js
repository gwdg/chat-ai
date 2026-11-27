import { describe, expect, it } from "vitest";

import {
  appendArcanaActionMarkers,
  arcanaActionKey,
  arcanaActionReversible,
  arcanaActionSummary,
  getArcanaActionProposals,
  normalizeArcanaAction,
  serializeArcanaAction,
  stripArcanaActionMarkers,
} from "../arcanaActions";

const collection = "tester__test";

const writeAction = {
  op: "write_text_file",
  collection,
  filename: "note.md",
  content: "hello ] ] ] world",
  size: 17,
  existed: false,
  previousText: null,
};

describe("Arcana action markers", () => {
  it("round-trips every field, including brackets and non-ASCII text", () => {
    const action = {
      op: "write_text_file",
      collection,
      filename: "note.md",
      content: "Grüße ]]] [[ARCANA_ACTION:",
      size: 10,
      existed: true,
      previousText: "old ] text",
    };
    const marker = serializeArcanaAction(action);

    expect(marker.startsWith("[[ARCANA_ACTION:")).toBe(true);
    expect(marker).not.toContain("]]]");
    expect(getArcanaActionProposals(marker, collection)).toEqual([action]);
  });

  it("keeps the proposal invisible in the rendered transcript", () => {
    const text = appendArcanaActionMarkers("Done.", [writeAction]);
    expect(text).toContain("Done.");
    expect(stripArcanaActionMarkers(text)).toBe("Done.");
  });

  it("returns only markers for an answer that has no text", () => {
    const text = appendArcanaActionMarkers("", [writeAction]);
    expect(stripArcanaActionMarkers(text)).toBe("");
    expect(getArcanaActionProposals(text, collection)).toHaveLength(1);
  });

  it("ignores a malformed marker and an unknown op", () => {
    const text = "[[ARCANA_ACTION:not-base64!]] [[ARCANA_ACTION:%%%]]";
    expect(getArcanaActionProposals(text, collection)).toEqual([]);
  });

  it("drops an action that names another collection", () => {
    const marker = serializeArcanaAction(writeAction);
    expect(getArcanaActionProposals(marker, "other__arcana")).toEqual([]);
    expect(getArcanaActionProposals(marker)).toHaveLength(1);
  });

  it("rejects a filename that points outside the collection", () => {
    expect(
      normalizeArcanaAction({
        op: "delete_file",
        collection,
        filename: "../secret.md",
      }),
    ).toBeNull();
    expect(
      normalizeArcanaAction({
        op: "delete_file",
        collection,
        filename: "a/b.md",
      }),
    ).toBeNull();
  });

  it("requires the file identity an upload needs to apply", () => {
    expect(
      normalizeArcanaAction({
        op: "upload_attachment",
        collection,
        filename: "note.md",
      }),
    ).toBeNull();
  });

  it("deduplicates the same proposed change", () => {
    const marker = serializeArcanaAction(writeAction);
    const proposals = getArcanaActionProposals(`${marker}${marker}`, collection);
    expect(proposals).toHaveLength(1);
    expect(arcanaActionKey(proposals[0])).toBe("write_text_file:note.md");
  });

  it("keeps two different tag changes of one file apart", () => {
    const left = { ...writeAction, op: "set_file_tags", tags: ["a"], previousTags: [] };
    const right = { ...left, tags: ["b"] };
    const text = appendArcanaActionMarkers("", [left, right]);
    expect(getArcanaActionProposals(text, collection)).toHaveLength(2);
  });
});

describe("Arcana action reversibility", () => {
  it("restores tags and removes a newly written file", () => {
    expect(
      arcanaActionReversible({
        op: "set_file_tags",
        filename: "a.md",
        tags: ["b"],
        previousTags: ["a"],
      }),
    ).toBe(true);
    expect(arcanaActionReversible(writeAction)).toBe(true);
  });

  it("cannot restore an overwritten converted or binary file", () => {
    expect(
      arcanaActionReversible({ ...writeAction, existed: true, previousText: null }),
    ).toBe(false);
    expect(
      arcanaActionReversible({
        op: "upload_attachment",
        filename: "a.md",
        existed: true,
      }),
    ).toBe(false);
    expect(
      arcanaActionReversible({
        op: "delete_file",
        filename: "report.pdf",
        restoreText: null,
      }),
    ).toBe(false);
  });

  it("never reverts indexing", () => {
    expect(arcanaActionReversible({ op: "start_index", collection })).toBe(false);
  });
});

describe("Arcana action summaries", () => {
  it("names the file and the collection with the values the copy needs", () => {
    expect(arcanaActionSummary(writeAction)).toEqual({
      key: "arcana_chat.action_write",
      values: { name: "note.md", size: "17 B" },
    });
    expect(
      arcanaActionSummary({
        op: "set_file_tags",
        filename: "a.md",
        tags: [],
      }),
    ).toEqual({
      key: "arcana_chat.action_tags",
      values: { name: "a.md", tags: "—" },
    });
  });
});
