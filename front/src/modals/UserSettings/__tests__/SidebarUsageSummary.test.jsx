import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SidebarUsageSummary from "../SidebarUsageSummary";

const splitData = {
  external: {
    limits: {
      user: { monthly_usage: 1, monthly_limit: 100 },
      org: { monthly_usage_percent: 0.05 },
    },
  },
  internal: {
    limits: { user: { monthly_usage: 2, monthly_limit: 100 } },
  },
};

const flatData = {
  limits: {
    user: { monthly_usage: 3.5, monthly_limit: 100 },
    org: { monthly_usage_percent: 0.25 },
  },
};

describe("SidebarUsageSummary", () => {
  it("keeps one compact figure per scope when the account is split", () => {
    render(<SidebarUsageSummary data={splitData} />);

    expect(screen.getByText("Usage")).toBeInTheDocument();
    expect(screen.getByText("External")).toBeInTheDocument();
    expect(screen.getByText("Internal")).toBeInTheDocument();
    expect(screen.getByText("1 / 100€")).toBeInTheDocument();
    expect(screen.getByText("2 / 100€")).toBeInTheDocument();
  });

  it("shows the Usage tab figures when there is no internal/external split", () => {
    render(<SidebarUsageSummary data={flatData} onOpenUsage={vi.fn()} />);

    expect(screen.getByText("Usage")).toBeInTheDocument();
    expect(screen.getByText("Personal monthly")).toBeInTheDocument();
    expect(screen.getByText("3.5 / 100€")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show details" }));

    expect(screen.getByText("Personal")).toBeInTheDocument();
    expect(screen.getByText("Organization")).toBeInTheDocument();
    expect(screen.getByText("25.00%")).toBeInTheDocument();
  });

  it("opens the usage settings tab when the card title is clicked", () => {
    const onOpenUsage = vi.fn();
    render(<SidebarUsageSummary data={flatData} onOpenUsage={onOpenUsage} />);

    fireEvent.click(screen.getByRole("button", { name: "Usage" }));
    expect(onOpenUsage).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Show details" }));
    expect(onOpenUsage).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Personal")).toBeInTheDocument();
    expect(screen.getByText("Organization")).toBeInTheDocument();
  });

  it("points the chevron up while folded and down once the figures are shown", () => {
    const { container } = render(<SidebarUsageSummary data={flatData} />);
    const chevron = () => container.querySelector("svg");

    // Folded: up, at the card it will unfold. Open: down, at the figures it shows.
    expect(chevron()).toHaveClass("rotate-180");
    expect(chevron()).not.toHaveClass("-rotate-90");
    fireEvent.click(screen.getByRole("button", { name: "Usage" }));
    expect(chevron()).not.toHaveClass("rotate-180");
    expect(chevron()).not.toHaveClass("-rotate-90");
  });

  it("stays out of the sidebar when the account reports no figures at all", () => {
    const { container } = render(<SidebarUsageSummary data={{}} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("opens the usage tab from anywhere on the card except the arrow", () => {
    const onOpenUsage = vi.fn();
    render(<SidebarUsageSummary data={flatData} onOpenUsage={onOpenUsage} />);

    fireEvent.click(screen.getByText("3.5 / 100€"));
    expect(onOpenUsage).toHaveBeenCalledTimes(1);
    // The figure click is the profile's way in, not the local fold.
    expect(
      screen.getByRole("button", { name: "Show details" }),
    ).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(screen.getByRole("button", { name: "Usage" }));
    expect(onOpenUsage).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole("button", { name: "Show details" }));
    expect(onOpenUsage).toHaveBeenCalledTimes(2);
    expect(
      screen.getByRole("button", { name: "Show details" }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("sits almost on the sidebar's own colour, not on a grey card", () => {
    const { container } = render(<SidebarUsageSummary data={flatData} />);
    const card = container.firstElementChild;

    // A third of a step away from the sidebar, so it marks the block without
    // reading as another section band (those are bg-base-200/70).
    expect(card.className).toContain("bg-base-200/40");
    expect(card.className).not.toMatch(/(^|\s)bg-base-200(\s|$)/);
  });
});
