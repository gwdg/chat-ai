import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AgentAssistantParts from "../AgentAssistantParts";

const toolPart = (name, input) => ({
  type: "tool",
  name,
  state: { input, status: "completed" },
});

describe("AgentAssistantParts file cards", () => {
  it("opens a file a read call worked on in the preview", () => {
    const onOpenFile = vi.fn();
    render(
      <AgentAssistantParts
        parts={[toolPart("read", { filePath: "/work/notes.md" })]}
        onOpenFile={onOpenFile}
      />,
    );

    expect(screen.getByText("/work/notes.md")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Preview notes.md" }));

    expect(onOpenFile).toHaveBeenCalledWith("/work/notes.md");
  });

  it("offers the written file too", () => {
    const onOpenFile = vi.fn();
    render(
      <AgentAssistantParts
        parts={[toolPart("write", { path: "reports/summary.csv" })]}
        onOpenFile={onOpenFile}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Preview summary.csv" }));

    expect(onOpenFile).toHaveBeenCalledWith("reports/summary.csv");
  });

  it("adds no card for other tools or without a preview handler", () => {
    const { rerender } = render(
      <AgentAssistantParts
        parts={[toolPart("bash", { command: "ls" })]}
        onOpenFile={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /^Preview/ }),
    ).not.toBeInTheDocument();

    rerender(
      <AgentAssistantParts
        parts={[toolPart("read", { filePath: "/work/notes.md" })]}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /^Preview/ }),
    ).not.toBeInTheDocument();
  });
});
