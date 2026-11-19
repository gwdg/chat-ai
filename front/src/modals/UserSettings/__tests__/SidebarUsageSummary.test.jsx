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

  it("points the chevron the way the sidebar sections do", () => {
    const { container } = render(<SidebarUsageSummary data={flatData} />);
    const chevron = () => container.querySelector("svg");

    // Closed: right, like a folded sidebar section. Open: down, at the list it shows.
    expect(chevron()).toHaveClass("-rotate-90");
    fireEvent.click(screen.getByRole("button", { name: "Usage" }));
    expect(chevron()).not.toHaveClass("-rotate-90");
    expect(chevron()).not.toHaveClass("rotate-180");
  });

  it("stays out of the sidebar when the account reports no figures at all", () => {
    const { container } = render(<SidebarUsageSummary data={{}} />);

    expect(container).toBeEmptyDOMElement();
  });
});
