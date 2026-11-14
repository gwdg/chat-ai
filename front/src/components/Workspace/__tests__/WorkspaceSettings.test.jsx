import { fireEvent, render, screen } from "@testing-library/react";
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
  it("toggles codemode with a tool tile in agent mode", () => {
    const setLocalState = vi.fn((updater) => updater(localState));
    render(
      <WorkspaceSettings
        localState={localState}
        setLocalState={setLocalState}
      />,
    );

    const codemode = screen.getByRole("button", { name: /codemode/i });
    expect(codemode.className).toContain("border-success");

    fireEvent.click(codemode);

    const next = setLocalState.mock.results[0].value;
    expect(next.settings.tools.codemode).toBe(false);
  });

  it("keeps the tool limit without agent mode", () => {
    agentMocks.agent = false;
    render(
      <WorkspaceSettings
        localState={localState}
        setLocalState={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /codemode/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Limit tool calls per response"),
    ).toBeInTheDocument();
  });
});
