import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  requestMcpConfirmation,
  resetMcpConfirmationSession,
  resolveMcpConfirmation,
} from "../../../../agent/mcpConfirmation";

let userSettings = {};
vi.mock("react-redux", () => ({
  useSelector: (selector) =>
    selector({ user_settings: userSettings, interface_settings: {} }),
}));

import AgentSteps from "../AgentSteps";

const message = (blocks) => [{ role: "assistant", content: blocks }];

beforeEach(() => {
  userSettings = {};
  resetMcpConfirmationSession();
});

describe("AgentSteps", () => {
  it("keeps streamed reasoning inside its own block when the preference is off", () => {
    userSettings = { collapse_reasoning_while_streaming: false };
    render(
      <AgentSteps
        isLoading
        renderMode="Default"
        agentMessages={message([
          { type: "thinking", thinking: "The user wants a random png." },
          {
            type: "toolCall",
            id: "call-1",
            name: "codemode",
            arguments: { code: "console.log('hello')" },
          },
        ])}
      />
    );

    expect(screen.getByText("The user wants a random png.")).toBeInTheDocument();
    expect(screen.getByText(/Reasoning Process/)).toBeInTheDocument();
    expect(screen.getByText(/Running code/)).toBeInTheDocument();
  });

  it("keeps reasoning collapsed by default and shows the word count while streaming", () => {
    render(
      <AgentSteps
        isLoading
        renderMode="Default"
        agentMessages={message([
          { type: "thinking", thinking: "The user wants a random png." },
        ])}
      />,
    );

    expect(
      screen.queryByText("The user wants a random png."),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: /Reasoning in progress|Denkprozess läuft/,
      }),
    ).toBeInTheDocument();
  });

  it("renders a completed codemode call as code plus output", () => {
    render(
      <AgentSteps
        isLoading={false}
        renderMode="Default"
        agentMessages={[
          {
            role: "assistant",
            content: [
              {
                type: "toolCall",
                id: "call-1",
                name: "codemode",
                arguments: { code: "console.log('hello')" },
              },
            ],
          },
          {
            role: "toolResult",
            toolCallId: "call-1",
            content: [{ type: "text", text: "hello" }],
            isError: false,
          },
        ]}
      />
    );

    expect(screen.getByText("Code output")).toBeInTheDocument();
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  it("marks a tool call that is always allowed", async () => {
    const pending = requestMcpConfirmation({
      id: "call-2",
      server: "http://localhost:9000",
      tool: "read_file",
      callName: "folder__read_file",
      args: {},
    });
    resolveMcpConfirmation("call-2", true, true);
    await pending;

    render(
      <AgentSteps
        isLoading={false}
        renderMode="Default"
        agentMessages={message([
          {
            type: "toolCall",
            id: "call-3",
            name: "folder__read_file",
            arguments: { path: "/a" },
          },
        ])}
      />,
    );

    expect(screen.getByText(/always allowed|immer erlaubt/i)).toBeInTheDocument();
  });
});
