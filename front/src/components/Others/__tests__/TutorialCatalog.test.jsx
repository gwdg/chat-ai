import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import TutorialCatalog from "../TutorialCatalog";

const state = vi.hoisted(() => ({
  tools: false,
  agent: false,
  agents: true,
  arcanas: true,
  feedback: false,
  speech: false,
  sync: false,
  features: {},
}));

vi.mock("../../../utils/modules", () => ({
  isToolsEnabled: () => state.tools,
  isAgentEnabled: () => state.agent,
  isAgentsEnabled: () => state.agents,
  isArcanasEnabled: () => state.arcanas,
  isFeedbackEnabled: () => state.feedback,
  isSpeechEnabled: () => state.speech,
  isSyncEnabled: () => state.sync,
}));

vi.mock("../../../config/deployment", () => ({
  isFeatureEnabled: (name) => state.features[name] !== false,
}));

vi.mock("../../../context/FeatureGuideContext", () => ({
  useFeatureGuide: () => ({ startGuide: vi.fn() }),
}));

vi.mock("react-redux", () => ({
  useSelector: () => [],
}));

const openCatalog = () =>
  fireEvent.click(screen.getByRole("button", { name: /browse tutorials/i }));

beforeEach(() => {
  state.tools = false;
  state.agent = false;
  state.agents = true;
  state.arcanas = true;
  state.feedback = false;
  state.speech = false;
  state.sync = false;
  state.features = {};
});

describe("TutorialCatalog module gating", () => {
  it("offers no tools guides while the tools panel does not exist", () => {
    render(<TutorialCatalog />);
    openCatalog();

    expect(screen.queryByText("Use Web Search")).not.toBeInTheDocument();
    expect(screen.queryByText("Use Arcana for RAG")).not.toBeInTheDocument();
    expect(screen.getByText("Select a model")).toBeInTheDocument();
  });

  it("lists the tools guides once the tools module is on", () => {
    state.tools = true;
    render(<TutorialCatalog />);
    openCatalog();

    expect(screen.getByText("Use Web Search")).toBeInTheDocument();
  });

  it("lists them in agent mode, and Arcana only with the arcanas module", () => {
    state.agent = true;
    state.arcanas = false;
    render(<TutorialCatalog />);
    openCatalog();

    expect(screen.getByText("Use Web Search")).toBeInTheDocument();
    expect(screen.queryByText("Use Arcana for RAG")).not.toBeInTheDocument();
  });

  it("hides the sync, speech and feedback guides with their modules off", () => {
    render(<TutorialCatalog />);
    openCatalog();

    expect(
      screen.queryByText("Encrypted server synchronization"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Read answers aloud")).not.toBeInTheDocument();
    expect(screen.queryByText("Send feedback")).not.toBeInTheDocument();
  });

  it("hides the workspace and agent guides the deployment switched off", () => {
    state.features = { workspaces: false };
    state.agents = false;
    render(<TutorialCatalog />);
    openCatalog();

    expect(screen.queryByText("Workspaces")).not.toBeInTheDocument();
    expect(screen.queryByText("Spawn a remote agent")).not.toBeInTheDocument();
    expect(screen.getByText("Select a model")).toBeInTheDocument();
  });
});
