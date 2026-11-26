import { describe, expect, it } from "vitest";

import {
  ARCANA_SHARE_PARAM,
  arcanaShareFromSettings,
  buildArcanaShareLink,
  parseArcanaShareRef,
} from "../arcanaShareLink";

describe("parseArcanaShareRef", () => {
  it("splits a storage name into owner and collection name", () => {
    expect(parseArcanaShareRef("alice__papers")).toEqual({
      collection: "alice__papers",
      owner: "alice",
      name: "papers",
    });
  });

  it("keeps a name that contains the separator", () => {
    expect(parseArcanaShareRef("alice__team__papers")).toEqual({
      collection: "alice__team__papers",
      owner: "alice",
      name: "team__papers",
    });
  });

  it("trims surrounding whitespace", () => {
    expect(parseArcanaShareRef("  alice__papers \n")?.collection).toBe(
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
    "alice__../etc",
    "alice__papers/x",
    "alice__papers\\x",
    "ali\u0000ce__papers",
    "a".repeat(400) + "__papers",
  ])("refuses a value that cannot be a storage name: %p", (value) => {
    expect(parseArcanaShareRef(value)).toBeNull();
  });
});

describe("buildArcanaShareLink", () => {
  it("builds an absolute chat link for the collection", () => {
    expect(buildArcanaShareLink("alice__papers", "https://chat.example")).toBe(
      "https://chat.example/chat?arcana_share=alice__papers",
    );
  });

  it("does not double the slash of the origin", () => {
    expect(buildArcanaShareLink("alice__papers", "https://chat.example/")).toBe(
      "https://chat.example/chat?arcana_share=alice__papers",
    );
  });

  it("encodes characters that a query value cannot carry", () => {
    expect(buildArcanaShareLink("alice__a b&c", "https://chat.example")).toBe(
      "https://chat.example/chat?arcana_share=alice__a%20b%26c",
    );
  });

  it("uses the page origin by default", () => {
    expect(buildArcanaShareLink("alice__papers")).toBe(
      `${window.location.origin}/chat?${ARCANA_SHARE_PARAM}=alice__papers`,
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
