import { beforeEach, describe, expect, it } from "vitest";

import {
  openWorkspaceAgents,
  openWorkspaceFiles,
} from "../featureGuideActions.js";

const tab = () =>
  document.querySelector('[data-guide="meta-tab-agents"]');
const filesTab = () =>
  document.querySelector('[data-guide="meta-tab-files"]');

describe("openWorkspaceAgents", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("clicks the Agents tab when the guide needs the agent panel", () => {
    document.body.innerHTML =
      '<button data-guide="meta-tab-agents" aria-selected="false"></button>';
    let clicks = 0;
    tab().addEventListener("click", () => {
      clicks += 1;
    });

    openWorkspaceAgents();

    expect(clicks).toBe(1);
  });

  it("leaves an already selected tab alone", () => {
    document.body.innerHTML =
      '<button data-guide="meta-tab-agents" aria-selected="true"></button>';
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

describe("openWorkspaceFiles", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("clicks the Files tab when the guide needs the workspace tree", () => {
    document.body.innerHTML =
      '<button data-guide="meta-tab-files" aria-selected="false"></button>';
    let clicks = 0;
    filesTab().addEventListener("click", () => {
      clicks += 1;
    });

    openWorkspaceFiles();

    expect(clicks).toBe(1);
  });

  it("leaves an already selected Files tab alone", () => {
    document.body.innerHTML =
      '<button data-guide="meta-tab-files" aria-selected="true"></button>';
    let clicks = 0;
    filesTab().addEventListener("click", () => {
      clicks += 1;
    });

    openWorkspaceFiles();

    expect(clicks).toBe(0);
  });
});
