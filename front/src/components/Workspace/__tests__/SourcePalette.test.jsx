import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SourcePalette from "../SourcePalette";

describe("SourcePalette", () => {
  it("offers local and Git actions with accessible names", () => {
    const onPick = vi.fn();
    render(<SourcePalette onPick={onPick} />);

    const local = screen.getByRole("button", { name: "Local folder" });
    const git = screen.getByRole("button", { name: "Git repository" });

    expect(local).toBeInTheDocument();
    expect(git).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "MCP server" })).not.toBeInTheDocument();

    fireEvent.click(local);
    fireEvent.click(git);

    expect(onPick.mock.calls).toEqual([["local"], ["git"]]);
  });

  it("offers the MCP action when local MCP servers are enabled", () => {
    const onPick = vi.fn();
    render(<SourcePalette onPick={onPick} mcpEnabled />);

    const mcp = screen.getByRole("button", { name: "MCP server" });
    fireEvent.click(mcp);

    expect(onPick).toHaveBeenCalledWith("mcp");
  });
});
