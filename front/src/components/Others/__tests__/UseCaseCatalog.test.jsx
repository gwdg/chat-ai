import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import UseCaseCatalog from "../UseCaseCatalog";

const state = vi.hoisted(() => ({
  tools: false,
  agent: false,
  arcanas: true,
  speech: false,
  features: {},
}));

vi.mock("../../../utils/modules", () => ({
  isToolsEnabled: () => state.tools,
  isAgentEnabled: () => state.agent,
  isAgentsEnabled: () => true,
  isArcanasEnabled: () => state.arcanas,
  isFeedbackEnabled: () => false,
  isSpeechEnabled: () => state.speech,
  isSyncEnabled: () => false,
}));

vi.mock("../../../config/deployment", () => ({
  isFeatureEnabled: (name) => state.features[name] !== false,
}));

vi.mock("../../../context/FeatureGuideContext", () => ({
  useFeatureGuide: () => ({ startGuide: vi.fn(), startCustomGuide: vi.fn() }),
}));

vi.mock("react-redux", () => ({
  useSelector: () => [],
}));

const openCatalog = () =>
  fireEvent.click(screen.getByRole("button", { name: /browse use cases/i }));

beforeEach(() => {
  state.tools = false;
  state.agent = false;
  state.arcanas = true;
  state.speech = false;
  state.features = {};
});

describe("UseCaseCatalog module gating", () => {
  it("offers no tool walkthroughs while the tools panel does not exist", () => {
    render(<UseCaseCatalog />);
    openCatalog();

    expect(
      screen.queryByText("Research current information"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Answer questions from your own documents"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Create an image for a slide"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Analyze a research paper")).toBeInTheDocument();
  });

  it("lists the tool walkthroughs once the tools module is on", () => {
    state.tools = true;
    render(<UseCaseCatalog />);
    openCatalog();

    expect(
      screen.getByText("Research current information"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Answer questions from your own documents"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Create an image for a slide"),
    ).toBeInTheDocument();
  });

  it("needs the arcanas module for the RAG walkthrough", () => {
    state.tools = true;
    state.arcanas = false;
    render(<UseCaseCatalog />);
    openCatalog();

    expect(
      screen.queryByText("Answer questions from your own documents"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Research current information"),
    ).toBeInTheDocument();
  });

  it("lists the read-aloud walkthrough only with the speech module", () => {
    const { unmount } = render(<UseCaseCatalog />);
    openCatalog();
    expect(screen.queryByText("Listen to an answer")).not.toBeInTheDocument();
    unmount();

    state.speech = true;
    render(<UseCaseCatalog />);
    openCatalog();
    expect(screen.getByText("Listen to an answer")).toBeInTheDocument();
  });

  it("hides the Meta-chat walkthrough when the Meta chat is off", () => {
    state.features = { meta_chat: false };
    render(<UseCaseCatalog />);
    openCatalog();

    expect(screen.queryByText("Find an old chat")).not.toBeInTheDocument();
    expect(screen.getByText("Analyze a research paper")).toBeInTheDocument();
  });
});
