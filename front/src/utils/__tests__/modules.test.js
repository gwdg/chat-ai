import { afterEach, describe, expect, it } from "vitest";
import { isAgentsEnabled } from "../modules";

const original = import.meta.env.VITE_MODULE_AGENTS;

afterEach(() => {
  if (original === undefined) delete import.meta.env.VITE_MODULE_AGENTS;
  else import.meta.env.VITE_MODULE_AGENTS = original;
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
