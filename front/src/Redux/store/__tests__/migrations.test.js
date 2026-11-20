import { describe, expect, it } from "vitest";
import { migrations } from "../migrations";

/**
 * `createMigrate` reduces with each migration's return value and rehydrates
 * nothing when the last one returns `undefined`. A migration that only mutates
 * in place therefore has to return the state as well, or an upgrade resets
 * every persisted setting to its default.
 */
const migrateFrom = (state, inboundVersion, currentVersion = 11) =>
  Object.keys(migrations)
    .map(Number)
    .filter((version) => version > inboundVersion && version <= currentVersion)
    .sort((a, b) => a - b)
    .reduce((next, version) => migrations[version](next), state);

describe("redux migration contract", () => {
  it("returns the state from every migration", () => {
    const state = { _persist: { version: 0 } };
    for (const version of Object.keys(migrations).map(Number).sort()) {
      expect(migrations[version](state)).toBe(state);
    }
  });

  it("keeps unrelated settings when upgrading one version", () => {
    const state = {
      user_settings: { advanced_mode: true, memories: [{ id: "m1" }] },
      _persist: { version: 10 },
    };

    const migrated = migrateFrom(state, 10);

    expect(migrated.user_settings.advanced_mode).toBe(true);
    expect(migrated.user_settings.memories).toEqual([{ id: "m1" }]);
  });

  it("chains across several versions without losing settings", () => {
    const state = {
      user_settings: {
        advanced_mode: true,
        mcp_servers: [{ id: "mine", url: "http://localhost:9000/mcp" }],
      },
      interface_settings: { collapsed_topics: ["arcana_v2"] },
      _persist: { version: 8 },
    };

    const migrated = migrateFrom(state, 8);

    expect(migrated.user_settings.advanced_mode).toBe(true);
    expect(migrated.user_settings.mcp_servers).toEqual([
      { id: "mine", url: "http://localhost:9000/mcp" },
    ]);
    expect(migrated.interface_settings.completed_tutorials).toBeUndefined();
  });
});

describe("redux migration 11", () => {
  const migrate = (state) => migrations[11](state);

  it("drops a gateway entry and keeps URL servers", () => {
    const state = {
      user_settings: {
        mcp_servers: [
          { id: "kept", name: "Files", url: " http://localhost:9000/mcp " },
          { id: "gateway", name: "GWDG", serverId: "server-1" },
          "bare-gateway-id",
        ],
      },
    };

    migrate(state);

    expect(state.user_settings.mcp_servers).toEqual([
      { id: "kept", name: "Files", url: "http://localhost:9000/mcp" },
    ]);
  });

  it("strips the removed kind and serverId fields", () => {
    const state = {
      user_settings: {
        mcp_servers: [
          {
            id: "legacy-local",
            kind: "local",
            url: "http://localhost:9000/mcp",
            headers: { Authorization: "Bearer x" },
          },
        ],
      },
    };

    migrate(state);

    expect(state.user_settings.mcp_servers).toEqual([
      {
        id: "legacy-local",
        url: "http://localhost:9000/mcp",
        headers: { Authorization: "Bearer x" },
      },
    ]);
  });

  it("leaves an empty or missing list empty", () => {
    const state = { user_settings: {} };
    migrate(state);
    expect(state.user_settings.mcp_servers).toEqual([]);
  });
});
