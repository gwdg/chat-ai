import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import WarningExternalModel, { DataSafetyText } from "../WarningExternalModel";

const localState = (settings) => ({ settings });

describe("data safety warning", () => {
  it("warns for external models", () => {
    render(
      <DataSafetyText
        localState={localState({
          model: { name: "OpenAI External" },
          enable_tools: true,
          tools: {},
        })}
        userData={{}}
      />,
    );
    expect(screen.getByText(/external model or external tools/i)).toBeInTheDocument();
  });

  it("warns when MCP is enabled", () => {
    render(
      <DataSafetyText
        localState={localState({ model: { name: "Internal" }, tools: { mcp: true } })}
        userData={{}}
      />,
    );
    expect(screen.getByText(/external model or external tools/i)).toBeInTheDocument();
  });

  it("stays silent for safe local settings", () => {
    const { container } = render(
      <DataSafetyText
        localState={localState({
          model: { name: "Internal" },
          enable_tools: false,
          tools: { mcp: false, web_search: false },
        })}
        userData={{}}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the warning popover", () => {
    render(
      <WarningExternalModel
        localState={localState({ model: { name: "External" }, tools: {} })}
        userData={{}}
      />,
    );
    expect(screen.getByText(/external model or external tools/i)).toBeInTheDocument();
    expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
  });
});
