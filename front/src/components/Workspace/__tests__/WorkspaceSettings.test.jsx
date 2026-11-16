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

    expect(screen.getByText("Local agent")).toBeInTheDocument();
    const codemode = screen.getByRole("button", { name: /browser agent/i });
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
      screen.queryByRole("button", { name: /browser agent/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Limit tool calls per response"),
    ).toBeInTheDocument();
  });

  it("switches writing on for a chat without a workspace", () => {
    const setLocalState = vi.fn((updater) => updater(localState));
    render(
      <WorkspaceSettings
        localState={localState}
        setLocalState={setLocalState}
      />,
    );

    const write = screen.getByRole("button", { name: /allow write/i });
    expect(write).toBeEnabled();
    expect(write.className).not.toContain("border-success");

    fireEvent.click(write);

    expect(setLocalState.mock.results[0].value.settings.tools.write_access).toBe(
      true,
    );
  });

  it("keeps the writing switch out of a chat with an attached workspace", () => {
    render(
      <WorkspaceSettings
        localState={localState}
        setLocalState={vi.fn()}
        workspaceAttached
      />,
    );

    expect(
      screen.queryByRole("button", { name: /allow write/i }),
    ).not.toBeInTheDocument();
  });

  it("disables writing while access storage is off", () => {
    render(
      <WorkspaceSettings
        localState={{
          settings: { tools: { browser_storage: false }, max_tool_calls: 10 },
        }}
        setLocalState={vi.fn()}
      />,
    );

    const write = screen.getByRole("button", { name: /allow write/i });
    expect(write).toBeDisabled();
    expect(write).toHaveAttribute(
      "title",
      "Enable browser storage or share a local folder first",
    );
  });
});
