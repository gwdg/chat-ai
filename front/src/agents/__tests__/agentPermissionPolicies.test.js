import { beforeEach, describe, expect, it } from "vitest";

import {
  clearAgentPermissionPolicies,
  loadAgentPermissionPolicies,
  matchPermissionPolicy,
  saveAgentPermissionPolicies,
} from "../agentPermissionPolicies";

beforeEach(() => {
  localStorage.clear();
});

describe("agent permission policies", () => {
  it("persists and clears per-agent policies", () => {
    saveAgentPermissionPolicies("agent-1", [
      { id: "1", action: "bash", decision: "always" },
    ]);

    expect(loadAgentPermissionPolicies("agent-1")).toEqual([
      { id: "1", action: "bash", decision: "always" },
    ]);

    clearAgentPermissionPolicies("agent-1");
    expect(loadAgentPermissionPolicies("agent-1")).toEqual([]);
  });

  it("matches exact and wildcard actions", () => {
    const policies = [
      { id: "1", action: "bash*", decision: "reject" },
      { id: "2", action: "*", decision: "once" },
    ];

    expect(matchPermissionPolicy(policies, { action: "bash" })).toEqual(
      policies[0],
    );
    expect(matchPermissionPolicy(policies, { action: "edit" })).toEqual(
      policies[1],
    );
  });
});
