import { describe, expect, it } from "vitest";

import { isStateSyncAction, stateSyncConfig } from "../stateSync";

describe("cross-tab state sync", () => {
  it("broadcasts every user_settings mutation", () => {
    // A stale tab re-persists its own user_settings on any action, so a mutation that is not sent
    // to the other tabs is overwritten there (an added MCP server was lost on reload this way).
    for (const type of [
      "user_settings/addMcpServer",
      "user_settings/updateMcpServer",
      "user_settings/removeMcpServer",
      "user_settings/addMemory",
      "user_settings/addMemoryGroup",
      "user_settings/addE2eeKey",
      "user_settings/importUserSettings",
    ]) {
      expect(isStateSyncAction({ type })).toBe(true);
    }
  });

  it("keeps the global actions that were synced before", () => {
    for (const type of ["SET_ADV", "RESET_ALL", "MIGRATE", "SET_COUNT"]) {
      expect(isStateSyncAction({ type })).toBe(true);
    }
  });

  it("does not broadcast redux-persist internals or unrelated actions", () => {
    for (const type of [
      "persist/REHYDRATE",
      "persist/PERSIST",
      "interface_settings/toggleTopic",
      "conversations/addConversation",
      undefined,
    ]) {
      expect(isStateSyncAction({ type })).toBe(false);
    }
    expect(isStateSyncAction(undefined)).toBe(false);
  });

  it("is wired into the middleware config", () => {
    expect(stateSyncConfig.predicate).toBe(isStateSyncAction);
  });
});
