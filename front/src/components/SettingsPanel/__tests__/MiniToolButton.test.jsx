import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Wrench } from "lucide-react";
import MiniToolButton from "../MiniToolButton";

describe("MiniToolButton", () => {
  it("renders its label and guide attribute", () => {
    render(
      <MiniToolButton
        Icon={Wrench}
        label="MCP Server"
        onClick={() => {}}
        guideKey="mcp"
        warning
      />,
    );

    expect(screen.getByText("MCP Server")).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveAttribute("data-guide", "tool-mcp");
  });

  it("calls onClick", () => {
    const onClick = vi.fn();
    render(
      <MiniToolButton Icon={Wrench} label="Codemode" onClick={onClick} guideKey="codemode" />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
