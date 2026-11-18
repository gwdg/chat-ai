import { describe, expect, it } from "vitest";

import {
  directAgentAccessAllowed,
  isLoopbackHost,
  isServiceManagedAgent,
} from "../agentAccess";

describe("agent access", () => {
  it.each(["localhost", "LOCALHOST", "127.0.0.1", "::1", "[::1]", " localhost "])(
    "treats %s as a local host",
    (hostname) => {
      expect(isLoopbackHost(hostname)).toBe(true);
      expect(directAgentAccessAllowed(hostname)).toBe(true);
    },
  );

  it.each(["example.com", "192.168.178.82", "0.0.0.0", "", null])(
    "treats %s as a deployment host",
    (hostname) => {
      expect(isLoopbackHost(hostname)).toBe(false);
      expect(directAgentAccessAllowed(hostname)).toBe(false);
    },
  );

  it("reads the browser host when no hostname is passed", () => {
    // jsdom serves the app from localhost, so the default is local access.
    expect(directAgentAccessAllowed()).toBe(true);
  });

  it("recognises an agent served by the agent service", () => {
    expect(isServiceManagedAgent({ serviceAgentId: "service-1" })).toBe(true);
    expect(isServiceManagedAgent({ serviceAgentId: "" })).toBe(false);
    expect(isServiceManagedAgent({})).toBe(false);
    expect(isServiceManagedAgent(undefined)).toBe(false);
  });
});
