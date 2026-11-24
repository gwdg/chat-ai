import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import InstituteSection from "../InstituteSection";

const api = vi.hoisted(() => ({ brand: { value: null } }));

vi.mock("../../../config/BrandProvider", () => ({
  useBrand: () => ({ brand: api.brand.value }),
}));

beforeEach(() => {
  api.brand.value = null;
});

describe("InstituteSection", () => {
  it("renders nothing for a brand without institute or restrictions", () => {
    api.brand.value = { id: "chat-ai", name: "Chat AI" };

    const { container } = render(<InstituteSection />);

    expect(container).toBeEmptyDOMElement();
  });

  it("names the institute and lists every narrowing", () => {
    api.brand.value = {
      id: "restricted",
      name: "Restricted Chat AI",
      institute: {
        name: "Example Institute",
        unit: "Central IT",
        description: "A locked-down example.",
        contact: "mailto:it@example.org",
        links: [
          {
            label: "Usage rules",
            url: "https://example.org/rules",
          },
        ],
      },
      restrictions: {
        notice: "Only the approved model is offered.",
        models: { fixed: "qwen3-30b" },
        modules: { agents: false },
        features: { workspaces: false },
        external: { web_search: false, mcp: false },
      },
    };

    render(
      <InstituteSection modelsData={[{ id: "qwen3-30b", name: "Qwen 3 30B" }]} />,
    );

    expect(
      screen.getByRole("heading", { name: "Institution" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Example Institute")).toBeInTheDocument();
    expect(screen.getByText("Central IT")).toBeInTheDocument();
    expect(screen.getByText("A locked-down example.")).toBeInTheDocument();
    expect(
      screen.getByText("Only the approved model is offered."),
    ).toBeInTheDocument();

    expect(screen.getByText("Fixed to Qwen 3 30B")).toBeInTheDocument();
    expect(screen.getByText("Agents")).toBeInTheDocument();
    expect(screen.getByText("Workspaces")).toBeInTheDocument();
    // Two blocked capabilities share one row, so the value is a list.
    expect(
      screen.getByText("Web search, MCP servers"),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: /Usage rules/ }),
    ).toHaveAttribute("href", "https://example.org/rules");
    expect(screen.getByRole("link", { name: /Contact/ })).toHaveAttribute(
      "href",
      "mailto:it@example.org",
    );
  });

  it("shows an allowlist when the brand does not pin one model", () => {
    api.brand.value = {
      id: "restricted",
      name: "Restricted Chat AI",
      restrictions: { models: { allowed: ["a", "b"] } },
    };

    render(
      <InstituteSection
        modelsData={[
          { id: "a", name: "Model A" },
          { id: "b", name: "Model B" },
        ]}
      />,
    );

    expect(screen.getByText("Limited to Model A, Model B")).toBeInTheDocument();
  });
});
