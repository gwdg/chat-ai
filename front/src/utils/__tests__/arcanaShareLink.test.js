import { describe, expect, it } from "vitest";

import {
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

describe("arcanaSharesFromSettings", () => {
  it("reads every list binding with its description", () => {
    expect(
      arcanaSharesFromSettings({
        arcana_shares: [
          {
            collection: "alice__papers",
            name: "Papers 2026",
            description: "  Peer-reviewed   papers ",
          },
          { collection: "bob__notes" },
        ],
      }),
    ).toEqual([
      {
        collection: "alice__papers",
        owner: "alice",
        name: "Papers 2026",
        description: "Peer-reviewed papers",
      },
      { collection: "bob__notes", owner: "bob", name: "notes" },
    ]);
  });

  it("accepts the readable Arcana ID as a stored collection", () => {
    expect(
      arcanaSharesFromSettings({ arcana_shares: [{ collection: "alice/papers" }] }),
    ).toEqual([{ collection: "alice__papers", owner: "alice", name: "papers" }]);
  });

  it("adds the single link binding and deduplicates by storage name", () => {
    const shares = arcanaSharesFromSettings({
      arcana_share: { collection: "alice__papers", name: "Shared" },
      arcana_shares: [
        { collection: "alice/papers", description: "From the list" },
        { collection: "bob__notes" },
      ],
    });
    expect(shares.map((share) => share.collection)).toEqual([
      "alice__papers",
      "bob__notes",
    ]);
    // The list wins, and the link's description fills a gap when it has one.
    expect(shares[0].name).toBe("papers");
    expect(shares[0].description).toBe("From the list");
  });

  it("fills a missing description from the link binding", () => {
    const shares = arcanaSharesFromSettings({
      arcana_share: { collection: "alice__papers", description: "Shared" },
      arcana_shares: [{ collection: "alice__papers" }],
    });
    expect(shares).toHaveLength(1);
    expect(shares[0].description).toBe("Shared");
  });

  it("skips entries that cannot name a collection", () => {
    expect(
      arcanaSharesFromSettings({
        arcana_shares: ["papers", null, { collection: "eve/x/y" }, { collection: "bob__notes" }],
      }),
    ).toEqual([{ collection: "bob__notes", owner: "bob", name: "notes" }]);
  });

  it("returns an empty list for a chat without bindings", () => {
    expect(arcanaSharesFromSettings({})).toEqual([]);
    expect(arcanaSharesFromSettings(undefined)).toEqual([]);
    expect(arcanaSharesFromSettings({ arcana_shares: "alice__papers" })).toEqual([]);
  });

  it("clips an over-long description", () => {
    const shares = arcanaSharesFromSettings({
      arcana_shares: [
        { collection: "alice__papers", description: "x".repeat(400) },
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
