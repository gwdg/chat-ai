import { describe, expect, it } from "vitest";

import {
  deployment,
  deploymentId,
  hasDeployment,
  isFeatureEnabled,
  moduleValue,
  resolveFeature,
  resolveModuleValue,
} from "../deployment";
import minimal from "../deployments/minimal/index.json";

describe("deployment profile", () => {
  it("loads the default deployment", () => {
    expect(deploymentId).toBe("chat-ai");
    expect(hasDeployment).toBe(true);
    expect(deployment.schemaVersion).toBe(1);
  });

  it("keeps features on unless a profile disables them", () => {
    expect(isFeatureEnabled("meta_chat")).toBe(true);
    expect(resolveFeature({}, "meta_chat")).toBe(true);
    expect(resolveFeature({ features: { meta_chat: false } }, "meta_chat")).toBe(
      false,
    );
  });

  it("keeps the existing module defaults when a profile is silent", () => {
    expect(moduleValue("tools", false)).toBe(false);
    expect(moduleValue("agents", true)).toBe(true);
    expect(resolveModuleValue({}, "arcanas", true)).toBe(true);
  });

  it("lets a deployment override a module", () => {
    expect(resolveModuleValue({ modules: { tools: true } }, "tools", false)).toBe(
      true,
    );
    expect(resolveModuleValue({ modules: { tools: false } }, "tools", true)).toBe(
      false,
    );
  });
});

describe("minimal deployment", () => {
  it("keeps the Meta chat and turns every other feature off", () => {
    // The Meta chat works from stored summaries and its own function tools, so it
    // needs none of the modules this profile disables.
    expect(resolveFeature(minimal, "meta_chat")).toBe(true);
    for (const name of [
      "workspaces",
      "mcp_servers",
      "e2ee",
      "tutorials",
      "import_git",
    ]) {
      expect(resolveFeature(minimal, name)).toBe(false);
    }
  });

  it("turns every module off", () => {
    expect(minimal.modules.agent).toBe(false);
    expect(minimal.modules.agents).toBe(false);
    expect(minimal.modules.tools).toBe(false);
    expect(minimal.modules.choices).toBe(false);
    expect(minimal.modules.arcanas).toBe(false);
    expect(minimal.modules.speech).toBe(false);
  });

  it("still has a brand", () => {
    expect(minimal.brands.default).toBe("chat-ai");
  });
});
