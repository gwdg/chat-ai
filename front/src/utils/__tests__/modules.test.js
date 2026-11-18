import { afterEach, describe, expect, it } from "vitest";
import { isAgentEnabled, isAgentsEnabled } from "../modules";

const originalAgents = import.meta.env.VITE_MODULE_AGENTS;
const originalAgent = import.meta.env.VITE_MODULE_AGENT;

afterEach(() => {
  if (originalAgents === undefined) delete import.meta.env.VITE_MODULE_AGENTS;
  else import.meta.env.VITE_MODULE_AGENTS = originalAgents;
  if (originalAgent === undefined) delete import.meta.env.VITE_MODULE_AGENT;
  else import.meta.env.VITE_MODULE_AGENT = originalAgent;
});

describe("isAgentsEnabled", () => {
  it("is enabled unless the module is explicitly disabled", () => {
    delete import.meta.env.VITE_MODULE_AGENTS;
    expect(isAgentsEnabled()).toBe(true);

    import.meta.env.VITE_MODULE_AGENTS = "true";
    expect(isAgentsEnabled()).toBe(true);

    import.meta.env.VITE_MODULE_AGENTS = "false";
    expect(isAgentsEnabled()).toBe(false);
  });
});

describe("isAgentEnabled", () => {
  // vite.config.js forces the browser agent on unless front.json disables it, so
  // an unset flag is "on" too; only an explicit "false" turns it off.
  it("is opt-out, like the agent/agents/arcanas module defaults", () => {
    delete import.meta.env.VITE_MODULE_AGENT;
    expect(isAgentEnabled()).toBe(true);

    import.meta.env.VITE_MODULE_AGENT = "true";
    expect(isAgentEnabled()).toBe(true);

    import.meta.env.VITE_MODULE_AGENT = "false";
    expect(isAgentEnabled()).toBe(false);
  });
});
