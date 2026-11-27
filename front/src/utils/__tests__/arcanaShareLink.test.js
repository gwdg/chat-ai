import { describe, expect, it } from "vitest";

import {
  ARCANA_LEGACY_LINK_PARAM,
  ARCANA_LINK_PARAM,
  arcanaRefId,
  arcanaShareFromSettings,
  arcanaSharesFromSettings,
  buildArcanaShareLink,
  parseArcanaShareRef,
} from "../arcanaShareLink";

describe("parseArcanaShareRef", () => {
  it("reads the Arcana ID the manager shows", () => {
    expect(parseArcanaShareRef("alice/papers")).toEqual({
      collection: "alice/papers",
      owner: "alice",
      name: "papers",
    });
  });

  it("reads the older storage spelling into the same reference", () => {
    expect(parseArcanaShareRef("alice__papers")).toEqual({
      collection: "alice/papers",
      owner: "alice",
      name: "papers",
    });
  });

  it("keeps a name that contains the legacy separator", () => {
    expect(parseArcanaShareRef("alice__team__papers")).toEqual({
      collection: "alice/team__papers",
      owner: "alice",
      name: "team__papers",
    });
    expect(parseArcanaShareRef("alice/team__papers")).toEqual({
      collection: "alice/team__papers",
      owner: "alice",
      name: "team__papers",
    });
  });

  it("trims surrounding whitespace", () => {
    expect(parseArcanaShareRef("  alice/papers \n")?.collection).toBe(
      "alice/papers",
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

  it("refuses a slash-form owner that carries the legacy separator", () => {
    // `ali__ce` would split at the first `__` when the older spelling is read.
    expect(parseArcanaShareRef("ali__ce/papers")).toBeNull();
  });
});

describe("arcanaRefId", () => {
  it("renders the readable Arcana ID", () => {
    expect(
      arcanaRefId({ collection: "alice/papers", owner: "alice", name: "papers" }),
    ).toBe("alice/papers");
  });
});

describe("share-link parameter", () => {
  it("writes Arcana Tools under its own parameter", () => {
    expect(ARCANA_LINK_PARAM).toBe("arcana-tools");
  });

  it("still reads the parameter the link used before", () => {
    expect(ARCANA_LEGACY_LINK_PARAM).toBe("arcana");
  });
});

describe("buildArcanaShareLink", () => {
  it("builds the documented access link for the collection", () => {
    expect(buildArcanaShareLink("alice/papers", "https://chat.example")).toBe(
      "https://chat.example/chat?arcana-tools=alice/papers&enable_tools=true",
    );
  });

  it("accepts the older storage spelling", () => {
    expect(buildArcanaShareLink("alice__papers", "https://chat.example")).toBe(
      "https://chat.example/chat?arcana-tools=alice/papers&enable_tools=true",
    );
  });

  it("does not double the slash of the origin", () => {
    expect(buildArcanaShareLink("alice/papers", "https://chat.example/")).toBe(
      "https://chat.example/chat?arcana-tools=alice/papers&enable_tools=true",
    );
  });

  it("encodes characters that a query value cannot carry", () => {
    expect(buildArcanaShareLink("alice/a b&c", "https://chat.example")).toBe(
      "https://chat.example/chat?arcana-tools=alice/a%20b%26c&enable_tools=true",
    );
  });

  it("uses the page origin by default", () => {
    expect(buildArcanaShareLink("alice/papers")).toBe(
      `${window.location.origin}/chat?${ARCANA_LINK_PARAM}=alice/papers&enable_tools=true`,
    );
  });

  it("returns an empty string for an unusable reference", () => {
    expect(buildArcanaShareLink("papers", "https://chat.example")).toBe("");
    expect(buildArcanaShareLink("alice/papers", "")).toBe("");
  });
});

describe("arcanaSharesFromSettings", () => {
  it("reads every list binding with its description", () => {
    expect(
      arcanaSharesFromSettings({
        arcana_shares: [
          {
            collection: "alice/papers",
            name: "Papers 2026",
            description: "  Peer-reviewed   papers ",
          },
          { collection: "bob/notes" },
        ],
      }),
    ).toEqual([
      {
        collection: "alice/papers",
        owner: "alice",
        name: "Papers 2026",
        description: "Peer-reviewed papers",
      },
      { collection: "bob/notes", owner: "bob", name: "notes" },
    ]);
  });

  it("normalises the older storage spelling on read", () => {
    expect(
      arcanaSharesFromSettings({ arcana_shares: [{ collection: "alice__papers" }] }),
    ).toEqual([{ collection: "alice/papers", owner: "alice", name: "papers" }]);
  });

  it("adds the single link binding and deduplicates by reference", () => {
    const shares = arcanaSharesFromSettings({
      arcana_share: { collection: "alice__papers", name: "Shared" },
      arcana_shares: [
        { collection: "alice/papers", description: "From the list" },
        { collection: "bob/notes" },
      ],
    });
    expect(shares.map((share) => share.collection)).toEqual([
      "alice/papers",
      "bob/notes",
    ]);
    // The list wins, and the link's description fills a gap when it has one.
    expect(shares[0].name).toBe("papers");
    expect(shares[0].description).toBe("From the list");
  });

  it("fills a missing description from the link binding", () => {
    const shares = arcanaSharesFromSettings({
      arcana_share: { collection: "alice/papers", description: "Shared" },
      arcana_shares: [{ collection: "alice__papers" }],
    });
    expect(shares).toHaveLength(1);
    expect(shares[0].description).toBe("Shared");
  });

  it("skips entries that cannot name a collection", () => {
    expect(
      arcanaSharesFromSettings({
        arcana_shares: ["papers", null, { collection: "eve/x/y" }, { collection: "bob/notes" }],
      }),
    ).toEqual([{ collection: "bob/notes", owner: "bob", name: "notes" }]);
  });

  it("returns an empty list for a chat without bindings", () => {
    expect(arcanaSharesFromSettings({})).toEqual([]);
    expect(arcanaSharesFromSettings(undefined)).toEqual([]);
    expect(arcanaSharesFromSettings({ arcana_shares: "alice/papers" })).toEqual([]);
  });

  it("clips an over-long description", () => {
    const shares = arcanaSharesFromSettings({
      arcana_shares: [
        { collection: "alice/papers", description: "x".repeat(400) },
      ],
    });
    expect(shares[0].description.length).toBe(280);
    expect(shares[0].description.endsWith("…")).toBe(true);
  });
});

describe("arcanaShareFromSettings", () => {
  it("reads a stored binding and keeps its display name", () => {
    expect(
      arcanaShareFromSettings({
        arcana_share: {
          collection: "alice/papers",
          name: "Papers 2026",
        },
      }),
    ).toEqual({
      collection: "alice/papers",
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
    expect(arcanaShareFromSettings({ arcana_share: "alice/papers" })).toBeNull();
    expect(
      arcanaShareFromSettings({ arcana_share: { collection: "papers" } }),
    ).toBeNull();
  });
});
