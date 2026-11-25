import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WorkspaceSettings from "../WorkspaceSettings";

const agentMocks = vi.hoisted(() => ({ agent: true }));

vi.mock("../../../apis/agentEndpoints", () => ({
  isAgentEnabled: () => agentMocks.agent,
}));

const localState = {
  settings: {
    tools: {},
    max_tool_calls: 10,
  },
};

beforeEach(() => {
  agentMocks.agent = true;
});

describe("WorkspaceSettings", () => {
  it("keeps only the tool limit in the Local agent section", () => {
    render(
      <WorkspaceSettings
        localState={localState}
        setLocalState={vi.fn()}
      />,
    );

    expect(screen.getByText("Local agent")).toBeInTheDocument();
    expect(
      screen.getByText("Limit tool calls per response"),
    ).toBeInTheDocument();
    // The Browser agent is the default workflow and writing lives under Access storage.
    expect(
      screen.queryByRole("button", { name: /browser agent/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /allow write/i }),
    ).not.toBeInTheDocument();
  });

  it("hides the tool limit without agent mode", () => {
    agentMocks.agent = false;
    render(
      <WorkspaceSettings
        localState={localState}
        setLocalState={vi.fn()}
      />,
    );

    expect(screen.getByText("Local agent")).toBeInTheDocument();
    expect(
      screen.queryByText("Limit tool calls per response"),
    ).not.toBeInTheDocument();
  });
});
