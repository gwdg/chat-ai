import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AgentSteps from "../AgentSteps";

const message = (blocks) => [{ role: "assistant", content: blocks }];

describe("AgentSteps", () => {
  it("keeps streamed reasoning inside its own block", () => {
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
});
