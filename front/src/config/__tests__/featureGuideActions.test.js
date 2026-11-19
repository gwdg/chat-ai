import { beforeEach, describe, expect, it } from "vitest";

import { openWorkspaceAgents } from "../featureGuideActions.js";

const tab = () =>
  document.querySelector('[data-guide="workspace-tab-agents"]');

describe("openWorkspaceAgents", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("clicks the Agents tab when the guide needs the agent panel", () => {
    document.body.innerHTML =
      '<button data-guide="workspace-tab-agents" aria-selected="false"></button>';
    let clicks = 0;
    tab().addEventListener("click", () => {
      clicks += 1;
    });

    openWorkspaceAgents();

    expect(clicks).toBe(1);
  });

  it("leaves an already selected tab alone", () => {
    document.body.innerHTML =
      '<button data-guide="workspace-tab-agents" aria-selected="true"></button>';
    let clicks = 0;
    tab().addEventListener("click", () => {
      clicks += 1;
    });

    openWorkspaceAgents();

    expect(clicks).toBe(0);
  });

  it("does nothing when the page has no workspace tab", () => {
    expect(() => openWorkspaceAgents()).not.toThrow();
  });
});
