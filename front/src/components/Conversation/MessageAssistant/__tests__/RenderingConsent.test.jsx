import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TypstBlock from "../TypstBlock";
import LatexBlock from "../LatexBlock";

const consent = vi.hoisted(() => ({
  granted: new Set(),
  grant: vi.fn(),
}));

vi.mock("../../../../hooks/useWasmConsent", () => ({
  useWasmConsent: (feature) => consent.granted.has(feature),
  grantWasmConsent: (...features) => {
    features.forEach((feature) => consent.granted.add(feature));
    consent.grant(...features);
  },
}));

vi.mock("react-redux", () => ({
  useSelector: () => true,
}));

describe("heavy renderer consent", () => {
  beforeEach(() => {
    consent.granted.clear();
    consent.grant.mockClear();
    localStorage.clear();
  });

  it("asks before downloading the Typst renderer", () => {
    render(<TypstBlock content="#set text(size: 12pt)\nHello" defaultRender />);

    expect(screen.getByText(/Download Typst renderer/)).toBeInTheDocument();
    expect(screen.getByText(/About 38 MB/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Download and render" }));
    expect(consent.grant).toHaveBeenCalledWith("typst");
  });

  it("asks for the LaTeX renderer alone when no TikZ is present", () => {
    render(<LatexBlock content="\\frac{1}{2}" defaultRender />);

    expect(screen.getByText(/Download LaTeX renderer/)).toBeInTheDocument();
    expect(screen.getByText(/About 0.4 MB/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Download and render" }));
    expect(consent.grant).toHaveBeenCalledWith("latex");
  });

  it("adds the TikZ download when the LaTeX block contains TikZ", () => {
    render(
      <LatexBlock
        content={"\\begin{tikzpicture}\\draw (0,0) -- (1,1);\\end{tikzpicture}"}
        defaultRender
      />
    );

    expect(screen.getByText(/Download LaTeX \+ TikZ renderer/)).toBeInTheDocument();
    expect(screen.getByText(/About 7.2 MB/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Download and render" }));
    expect(consent.grant).toHaveBeenCalledWith("latex", "tikz");
  });
});
