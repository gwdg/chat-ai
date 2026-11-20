import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ModelNoToolsWarning from "../ModelNoToolsWarning";

const mocks = vi.hoisted(() => ({ agent: true, supportsTools: true }));

vi.mock("../../../apis/agentEndpoints", () => ({
  isAgentEnabled: () => mocks.agent,
  modelSupportsTools: () => mocks.supportsTools,
}));

const localState = { settings: { model: { id: "test-model" } } };

beforeEach(() => {
  mocks.agent = true;
  mocks.supportsTools = true;
});

describe("ModelNoToolsWarning", () => {
  it("warns that a model without tool support runs without tools", () => {
    mocks.supportsTools = false;
    render(<ModelNoToolsWarning localState={localState} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      /does not support tools/i,
    );
  });

  it("stays silent for a model with tool support", () => {
    render(<ModelNoToolsWarning localState={localState} />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("stays silent while the agent module is off", () => {
    mocks.agent = false;
    mocks.supportsTools = false;
    render(<ModelNoToolsWarning localState={localState} />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
