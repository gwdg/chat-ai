import { describe, expect, it } from "vitest";

import {
  ARCANA_LINK_PARAM,
  arcanaRefId,
  arcanaShareFromSettings,
  buildArcanaShareLink,
  parseArcanaShareRef,
} from "../arcanaShareLink";

describe("parseArcanaShareRef", () => {
  it("reads the Arcana ID the manager shows", () => {
    expect(parseArcanaShareRef("alice/papers")).toEqual({
      collection: "alice__papers",
      owner: "alice",
      name: "papers",
    });
  });

  it("still reads the storage name the tools take", () => {
    expect(parseArcanaShareRef("alice__papers")).toEqual({
      collection: "alice__papers",
      owner: "alice",
      name: "papers",
    });
  });

  it("keeps a name that contains the storage separator", () => {
    expect(parseArcanaShareRef("alice__team__papers")).toEqual({
      collection: "alice__team__papers",
      owner: "alice",
      name: "team__papers",
    });
    expect(parseArcanaShareRef("alice/team__papers")).toEqual({
      collection: "alice__team__papers",
      owner: "alice",
      name: "team__papers",
    });
  });

  it("trims surrounding whitespace", () => {
    expect(parseArcanaShareRef("  alice/papers \n")?.collection).toBe(
      "alice__papers",
    );
  });

  it.each([
    undefined,
    null,
    42,
    {},
    "",
    "   ",
    "papers",
    "__papers",
    "alice__",
    "__",
    "/papers",
    "alice/",
    "alice/papers/x",
    "alice__papers/x",
    "alice/../etc",
    "alice__papers\\x",
    "ali\u0000ce__papers",
    "a".repeat(400) + "__papers",
  ])("refuses a value that cannot name one collection: %p", (value) => {
    expect(parseArcanaShareRef(value)).toBeNull();
  });

  it("refuses a slash-form owner that carries the storage separator", () => {
    // `ali__ce__papers` would split at the first `__` into the wrong owner.
    expect(parseArcanaShareRef("ali__ce/papers")).toBeNull();
  });
});

describe("arcanaRefId", () => {
  it("renders the readable Arcana ID", () => {
    expect(
      arcanaRefId({ collection: "alice__papers", owner: "alice", name: "papers" }),
    ).toBe("alice/papers");
  });
});

describe("buildArcanaShareLink", () => {
  it("builds the documented access link for the collection", () => {
    expect(buildArcanaShareLink("alice__papers", "https://chat.example")).toBe(
      "https://chat.example/chat?arcana=alice/papers&enable_tools=true",
    );
  });

  it("does not double the slash of the origin", () => {
    expect(buildArcanaShareLink("alice__papers", "https://chat.example/")).toBe(
      "https://chat.example/chat?arcana=alice/papers&enable_tools=true",
    );
  });

  it("encodes characters that a query value cannot carry", () => {
    expect(buildArcanaShareLink("alice__a b&c", "https://chat.example")).toBe(
      "https://chat.example/chat?arcana=alice/a%20b%26c&enable_tools=true",
    );
  });

  it("uses the page origin by default", () => {
    expect(buildArcanaShareLink("alice__papers")).toBe(
      `${window.location.origin}/chat?${ARCANA_LINK_PARAM}=alice/papers&enable_tools=true`,
    );
  });

  it("returns an empty string for an unusable reference", () => {
    expect(buildArcanaShareLink("papers", "https://chat.example")).toBe("");
    expect(buildArcanaShareLink("alice__papers", "")).toBe("");
  });
});

describe("arcanaShareFromSettings", () => {
  it("reads a stored binding and keeps its display name", () => {
    expect(
      arcanaShareFromSettings({
        arcana_share: {
          collection: "alice__papers",
          name: "Papers 2026",
        },
      }),
    ).toEqual({
      collection: "alice__papers",
      owner: "alice",
      name: "Papers 2026",
    });
  });

  it("falls back to the collection name when the display name is missing", () => {
    expect(
      arcanaShareFromSettings({ arcana_share: { collection: "alice__papers" } })
        ?.name,
    ).toBe("papers");
  });

  it("returns null for a missing or unusable binding", () => {
    expect(arcanaShareFromSettings({})).toBeNull();
    expect(arcanaShareFromSettings(undefined)).toBeNull();
    expect(arcanaShareFromSettings({ arcana_share: "alice__papers" })).toBeNull();
    expect(
      arcanaShareFromSettings({ arcana_share: { collection: "papers" } }),
    ).toBeNull();
  });
});
