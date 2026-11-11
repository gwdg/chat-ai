import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LatexBlock from "../LatexBlock";
import { selectRenderLatex } from "../../../../Redux/reducers/userSettingsReducer";

const mocks = vi.hoisted(() => ({ downloadHtml: vi.fn() }));

vi.mock("react-redux", () => ({
  useSelector: (selector) => selector === selectRenderLatex,
}));
vi.mock("../../../../hooks/useWasmConsent", () => ({
  useWasmConsent: () => true,
  grantWasmConsent: vi.fn(),
}));
vi.mock("../../../../hooks/useToast", () => ({
  useToast: () => ({ notifyError: vi.fn() }),
}));
vi.mock("faster-latex/web", () => ({
  default: async () => {},
  render: () => ({ html: "<p>E = mc²</p>", warnings: [] }),
  article_css: () => ".fl-article { color: #111; }",
}));
vi.mock("../../../../utils/download", () => ({
  downloadHtml: mocks.downloadHtml,
  renderedFilename: (base, extension) => `${base}.${extension}`,
}));

describe("LaTeX rendered download", () => {
  it("downloads a standalone HTML document with its CSS", async () => {
    render(<LatexBlock content="E = mc^2" defaultRender />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Download rendered document" })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Download rendered document" }));

    expect(mocks.downloadHtml).toHaveBeenCalledTimes(1);
    const [html, filename] = mocks.downloadHtml.mock.calls[0];
    expect(html).toContain("<style>");
    expect(html).toContain("E = mc²");
    expect(filename).toBe("latex.html");
  });
});
