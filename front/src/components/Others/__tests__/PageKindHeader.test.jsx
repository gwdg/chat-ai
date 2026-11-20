import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import PageKindHeader from "../PageKindHeader";

const renderHeader = (props = {}) =>
  render(
    <PageKindHeader
      kind="topic"
      title="Research"
      kindLabel="Topic"
      countLabel="1 chat"
      icon={<span>#</span>}
      iconColor="#8B5CF6"
      iconLabel="Choose icon"
      iconExpanded={false}
      onIconClick={vi.fn()}
      iconTestId="topic-header-icon"
      {...props}
    />,
  );

describe("PageKindHeader", () => {
  it("names the page kind before the chat count, after a middle dot", () => {
    renderHeader();

    const meta = screen.getByText(/1 chat/);
    expect(meta).toHaveTextContent("Topic · 1 chat");
    expect(meta.textContent).not.toContain("Topic. 1 chat");
  });

  it("wears the same shape for a workspace page", () => {
    renderHeader({
      kind: "workspace",
      kindLabel: "Workspace",
      countLabel: "2 chats",
      iconTestId: "workspace-header-icon",
    });

    const header = screen.getByTestId("workspace-page-header");
    expect(header).toHaveTextContent("Workspace · 2 chats");
    expect(screen.getByTestId("workspace-header-icon").className).toContain(
      "h-10 w-10",
    );
  });

  it("draws no band behind the header", () => {
    renderHeader();

    const header = screen.getByTestId("topic-page-header");
    expect(header.className).not.toContain("bg-");
    expect(header.className).not.toContain("border-b");
    expect(header.className).not.toContain("shadow");
  });

  it("keeps the icon a tinted tile and still opens the picker", () => {
    const onIconClick = vi.fn();
    renderHeader({ onIconClick });

    const tile = screen.getByTestId("topic-header-icon");
    expect(tile.className).toContain("h-10 w-10");
    expect(tile.className).toContain("rounded-2xl");
    expect(tile.style.backgroundColor).toBe("rgba(139, 92, 246, 0.16)");
    expect(tile.style.color).toBe("rgb(139, 92, 246)");

    tile.click();
    expect(onIconClick).toHaveBeenCalled();
  });

  it("draws a plain tile when there is no picker (the unsorted bucket)", () => {
    renderHeader({ onIconClick: undefined });

    expect(screen.queryByTestId("topic-header-icon")).not.toBeInTheDocument();
    expect(screen.getByText("#").closest("span[aria-hidden='true']")).not.toBeNull();
  });
});
