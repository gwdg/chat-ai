import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ChartJsChart from "../ChartJsChart";
import GraphvizDiagram from "../GraphvizDiagram";
import VegaLiteChart from "../VegaLiteChart";
import { selectHtmlLoadExternal } from "../../../../Redux/reducers/userSettingsReducer";

const mocks = vi.hoisted(() => ({
  loadExternal: false,
  renderEnabled: true,
  graphvizRender: vi.fn(() => ({
    status: "success",
    output: '<svg><script>alert(1)</script><text>graph</text></svg>',
  })),
  embed: vi.fn(async () => ({ view: { finalize: vi.fn() } })),
  chartConstructor: vi.fn(),
  chartDestroy: vi.fn(),
}));

vi.mock("react-redux", () => ({
  useSelector: (selector) =>
    selector === selectHtmlLoadExternal ? mocks.loadExternal : mocks.renderEnabled,
}));
vi.mock("../../../../hooks/useWasmConsent", () => ({
  useWasmConsent: () => true,
  grantWasmConsent: vi.fn(),
}));
vi.mock("@viz-js/viz", () => ({
  instance: async () => ({ render: mocks.graphvizRender }),
}));
vi.mock("vega-embed", () => ({
  default: mocks.embed,
}));
vi.mock("chart.js", () => {
  class Chart {
    constructor(canvas, config) {
      mocks.chartConstructor(canvas, config);
    }
    destroy() {
      mocks.chartDestroy();
    }
  }
  Chart.register = () => {};
  return { Chart, registerables: [] };
});

describe("diagram renderers", () => {
  beforeEach(() => {
    mocks.loadExternal = false;
    mocks.renderEnabled = true;
    mocks.graphvizRender.mockClear();
    mocks.embed.mockClear();
    mocks.chartConstructor.mockClear();
    mocks.chartDestroy.mockClear();
  });

  it("renders sanitized Graphviz SVG", async () => {
    const { container } = render(<GraphvizDiagram content="digraph { a -> b }" />);

    await waitFor(() => {
      expect(container.textContent).toContain("graph");
    });
    expect(container.querySelector("script")).toBeNull();
    expect(mocks.graphvizRender).toHaveBeenCalledWith(
      "digraph { a -> b }",
      { format: "svg", engine: "dot" },
    );
  });

  it("renders a Vega-Lite spec without actions", async () => {
    render(<VegaLiteChart content={'{"mark":"bar","data":{"values":[{"a":1}]}}'} />);

    await waitFor(() => expect(mocks.embed).toHaveBeenCalled());
    expect(mocks.embed.mock.calls[0][2]).toMatchObject({
      mode: "vega-lite",
      actions: false,
      renderer: "svg",
      tooltip: false,
    });
  });

  it("blocks external Vega data unless external references are enabled", async () => {
    const spec = '{"data":{"url":"https://example.com/data.csv"},"mark":"point"}';
    render(<VegaLiteChart content={spec} />);

    await waitFor(() => {
      expect(screen.getByText(/external data/i)).toBeInTheDocument();
    });
    expect(mocks.embed).not.toHaveBeenCalled();
  });

  it("shows code and offers to render when the rendering setting is off", async () => {
    mocks.renderEnabled = false;
    render(<ChartJsChart content={'{"type":"bar","data":{"labels":["a"],"datasets":[]}}'} />);

    expect(screen.getByRole("button", { name: "Render as Chart.js" })).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(mocks.chartConstructor).not.toHaveBeenCalled();
  });

  it("creates and destroys a Chart.js chart", async () => {
    const { unmount } = render(
      <ChartJsChart content={'{"type":"bar","data":{"labels":["a"],"datasets":[]}}'} />
    );

    await waitFor(() => expect(mocks.chartConstructor).toHaveBeenCalled());
    expect(mocks.chartConstructor.mock.calls[0][1]).toMatchObject({ type: "bar" });
    unmount();
    expect(mocks.chartDestroy).toHaveBeenCalled();
  });
});
