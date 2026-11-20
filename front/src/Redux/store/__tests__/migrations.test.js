import { describe, expect, it } from "vitest";
import { migrations } from "../migrations";

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
