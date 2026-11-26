import { beforeEach, describe, expect, it, vi } from "vitest";

// The catalogs, the Meta chat and the tour runtime all ask the availability maps
// in the config modules. These flags stand in for a deployment profile, so one
// test file can cover every combination without rebuilding the bundle.
const state = vi.hoisted(() => ({
  tools: false,
  agent: false,
  agents: true,
  arcanas: true,
  feedback: false,
  receiver: false,
  speech: false,
  sync: false,
  features: {},
}));

vi.mock("../../utils/modules.js", () => ({
  isToolsEnabled: () => state.tools,
  isAgentEnabled: () => state.agent,
  isAgentsEnabled: () => state.agents,
  isArcanasEnabled: () => state.arcanas,
  isFeedbackEnabled: () => state.feedback,
  isSpeechEnabled: () => state.speech,
  isSyncEnabled: () => state.sync,
}));

// The feedback controls exist only when the module is on *and* the deployment
// has a receiver, so one flag is not enough to render the guide's targets.
vi.mock("../../apis/feedback.js", () => ({
  feedbackEndpoint: () => (state.receiver ? "http://receiver.test/feedback" : ""),
  isFeedbackReportEnabled: () => state.receiver,
  isChatFeedbackEnabled: () => state.feedback && state.receiver,
}));

vi.mock("../deployment.js", () => ({
  isFeatureEnabled: (name) => state.features[name] !== false,
}));

const {
  buildFeatureGuidePrompt,
  getFeatureGuideMarker,
  isFeatureGuideAvailable,
} = await import("../featureGuides.js");
const {
  buildUseCaseGuide,
  buildUseCasePrompt,
  getUseCaseMarker,
  isUseCaseAvailable,
} = await import("../useCases.js");

const reset = () => {
  state.tools = false;
  state.agent = false;
  state.agents = true;
  state.arcanas = true;
  state.feedback = false;
  state.receiver = false;
  state.speech = false;
  state.sync = false;
  state.features = {};
};

beforeEach(reset);

describe("feature guide availability", () => {
  it("hides the tools guides until a tools panel exists", () => {
    expect(isFeatureGuideAvailable("web_search")).toBe(false);
    expect(isFeatureGuideAvailable("tools_overview")).toBe(false);
    expect(isFeatureGuideAvailable("image_generation")).toBe(false);

    state.tools = true;
    expect(isFeatureGuideAvailable("web_search")).toBe(true);
    expect(isFeatureGuideAvailable("tools_overview")).toBe(true);
    expect(isFeatureGuideAvailable("image_generation")).toBe(true);

    state.tools = false;
    // Agent mode renders the same tools panel with the agent's own toggles.
    state.agent = true;
    expect(isFeatureGuideAvailable("web_search")).toBe(true);
    expect(isFeatureGuideAvailable("tools_overview")).toBe(true);
  });

  it("needs the arcanas module for the Arcana guides only", () => {
    state.tools = true;
    state.arcanas = false;
    expect(isFeatureGuideAvailable("arcana")).toBe(false);
    expect(isFeatureGuideAvailable("arcana_tools")).toBe(false);
    expect(isFeatureGuideAvailable("web_search")).toBe(true);
    // The workspace's document drive is saia-rag now, not the Arcana source, so
    // the Arcanas module no longer gates it.
    expect(isFeatureGuideAvailable("workspace_saia_rag")).toBe(true);

    state.arcanas = true;
    expect(isFeatureGuideAvailable("arcana")).toBe(true);
    expect(isFeatureGuideAvailable("workspace_saia_rag")).toBe(true);
  });

  it("follows the workspace feature and the agents module", () => {
    expect(isFeatureGuideAvailable("workspace_overview")).toBe(true);
    expect(isFeatureGuideAvailable("pin_workspace")).toBe(true);
    expect(isFeatureGuideAvailable("remote_agents")).toBe(true);

    state.features = { workspaces: false };
    expect(isFeatureGuideAvailable("workspace_overview")).toBe(false);
    expect(isFeatureGuideAvailable("attach_chat_to_workspace")).toBe(false);
    expect(isFeatureGuideAvailable("pin_workspace")).toBe(false);
    // The agent page does not need a workspace.
    expect(isFeatureGuideAvailable("remote_agents")).toBe(true);

    state.features = {};
    state.agents = false;
    expect(isFeatureGuideAvailable("remote_agents")).toBe(false);
    expect(isFeatureGuideAvailable("agent_recovery")).toBe(false);
    expect(isFeatureGuideAvailable("pin_agent")).toBe(false);
    expect(isFeatureGuideAvailable("workspace_overview")).toBe(true);
  });

  it("hides the module- and feature-specific settings guides", () => {
    expect(isFeatureGuideAvailable("feedback")).toBe(false);
    expect(isFeatureGuideAvailable("speech_output")).toBe(false);
    expect(isFeatureGuideAvailable("sync_setup")).toBe(false);
    // e2ee is a feature that is on unless a profile turns it off.
    expect(isFeatureGuideAvailable("e2ee")).toBe(true);

    state.feedback = true;
    state.speech = true;
    state.sync = true;
    // The module alone is not enough: without a receiver the controls (and so
    // the guide's targets) are not rendered.
    expect(isFeatureGuideAvailable("feedback")).toBe(false);
    state.receiver = true;
    expect(isFeatureGuideAvailable("feedback")).toBe(true);
    expect(isFeatureGuideAvailable("speech_output")).toBe(true);
    expect(isFeatureGuideAvailable("sync_setup")).toBe(true);

    state.features = { e2ee: false };
    expect(isFeatureGuideAvailable("e2ee")).toBe(false);
    state.features = {};
    expect(isFeatureGuideAvailable("e2ee")).toBe(true);
  });

  it("gates the Meta-chat guides and narrows three of them", () => {
    expect(isFeatureGuideAvailable("meta_chat_usage")).toBe(true);

    state.features = { meta_chat: false };
    expect(isFeatureGuideAvailable("meta_chat_usage")).toBe(false);
    expect(isFeatureGuideAvailable("meta_chat_catalogs")).toBe(false);

    state.features = { mcp_servers: false, workspaces: false };
    state.agents = false;
    expect(isFeatureGuideAvailable("meta_chat_mcp")).toBe(false);
    expect(isFeatureGuideAvailable("meta_chat_workspaces")).toBe(false);
    expect(isFeatureGuideAvailable("meta_chat_agents")).toBe(false);
    // The plain Meta-chat guides only need the Meta chat itself.
    expect(isFeatureGuideAvailable("meta_chat_search")).toBe(true);
  });

  it("needs the MCP feature and a tools panel for the MCP guide", () => {
    expect(isFeatureGuideAvailable("mcp_server")).toBe(false);
    state.tools = true;
    expect(isFeatureGuideAvailable("mcp_server")).toBe(true);
    state.features = { mcp_servers: false };
    expect(isFeatureGuideAvailable("mcp_server")).toBe(false);
  });

  it("rejects unknown ids and leaves ungated guides alone", () => {
    expect(isFeatureGuideAvailable("does_not_exist")).toBe(false);
    expect(isFeatureGuideAvailable("")).toBe(false);
    expect(isFeatureGuideAvailable("select_model")).toBe(true);
    expect(isFeatureGuideAvailable("data_management")).toBe(true);
  });

  it("offers only available guides and use cases to the Meta chat", () => {
    const prompt = buildFeatureGuidePrompt();
    expect(prompt).toContain("select_model");
    expect(prompt).not.toContain("web_search:");
    expect(prompt).not.toContain("sync_setup:");
    expect(buildUseCasePrompt()).not.toContain("web_research:");
    expect(buildUseCasePrompt()).toContain("analyze_paper");

    state.tools = true;
    expect(buildFeatureGuidePrompt()).toContain("web_search:");
    expect(buildUseCasePrompt()).toContain("web_research:");
  });

  it("ignores markers of a guide or walkthrough it cannot run", () => {
    expect(getFeatureGuideMarker("[[GUIDE:web_search]]")).toBeNull();
    expect(getUseCaseMarker("[[USE_CASE:web_research]]")).toBeNull();
    expect(buildUseCaseGuide("read_aloud")).toBeNull();

    state.tools = true;
    expect(getFeatureGuideMarker("[[GUIDE:web_search]]")).toBe("web_search");
    expect(getUseCaseMarker("[[USE_CASE:web_research]]")).toBe("web_research");

    state.speech = true;
    expect(isUseCaseAvailable("read_aloud")).toBe(true);
    expect(buildUseCaseGuide("read_aloud")).not.toBeNull();
  });

  it("gates the one use case whose walkthrough needs the Meta chat", () => {
    expect(isUseCaseAvailable("find_chat")).toBe(true);
    state.features = { meta_chat: false };
    expect(isUseCaseAvailable("find_chat")).toBe(false);
    expect(buildUseCaseGuide("find_chat")).toBeNull();
  });

  it("offers the advanced-mode guide only while it reveals a section", () => {
    expect(isFeatureGuideAvailable("advanced_mode")).toBe(true);

    state.agents = false;
    // The MCP Servers section does not depend on the Agents module.
    expect(isFeatureGuideAvailable("advanced_mode")).toBe(true);

    state.features = { mcp_servers: false };
    expect(isFeatureGuideAvailable("advanced_mode")).toBe(false);

    state.features = {};
    expect(isFeatureGuideAvailable("advanced_mode")).toBe(true);
  });

  it("keeps the backup guides and walkthrough ungated", () => {
    expect(isFeatureGuideAvailable("backup_create")).toBe(true);
    expect(isFeatureGuideAvailable("backup_restore")).toBe(true);

    const guide = buildUseCaseGuide("backup_migration");
    expect(guide).not.toBeNull();
    expect(guide.steps).toHaveLength(4);
    expect(buildUseCasePrompt()).toContain("backup_migration:");
  });
});
