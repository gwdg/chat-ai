import { fireEvent, render, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The preview reads the same HTML preferences as fenced HTML blocks.
let settings = {};
vi.mock("react-redux", () => ({
  useSelector: (selector) =>
    selector({ user_settings: settings, interface_settings: {} }),
}));

import SandboxedHtmlPreview from "../SandboxedHtmlPreview";

const DOCUMENT = `<head><style>body { background: #fff; }</style></head>
<body>
<h3 id="x">Egress demo</h3>
<img src="http://127.0.0.1:8000/static-img">
<script>new Image().src = "http://127.0.0.1:8000/img-ping";</script>
</body>`;

const setup = ({ loadExternal = false, sanitization = "strict" } = {}) => {
  settings = {
    html_load_external: loadExternal,
    html_sanitization: sanitization,
  };
  const { container } = render(
    <SandboxedHtmlPreview content={DOCUMENT} title="preview" />
  );
  const frame = () => container.querySelector("iframe");
  const doc = () => frame().getAttribute("srcdoc") || "";
  const csp = () =>
    doc().match(
      /^<meta http-equiv="Content-Security-Policy" content="([^"]*)">/i
    )?.[1] || "";
  return { container, frame, doc, csp };
};

describe("SandboxedHtmlPreview", () => {
  it("renders strictly by default and keeps the document's own styles", () => {
    const { frame, doc, csp } = setup();

    expect(frame().getAttribute("sandbox")).toBe("");
    expect(doc()).toContain("body { background: #fff; }");
    expect(doc()).not.toMatch(/<script\b/i);
    expect(csp()).toContain("script-src 'none'");
    expect(csp()).toContain("connect-src 'none'");
    expect(csp()).not.toMatch(/img-src[^;]*\*/);
  });

  it("runs the page's scripts after switching to relaxed, without network", () => {
    const { container, frame, doc, csp } = setup();

    fireEvent.click(
      within(container).getByRole("button", { name: "Relaxed" })
    );

    expect(frame().getAttribute("sandbox")).toBe("allow-scripts");
    expect(doc()).toMatch(/<script\b/i);
    // Same policy as a relaxed fenced HTML block with external refs off.
    expect(csp()).toContain("script-src 'unsafe-inline' 'unsafe-eval'");
    expect(csp()).toContain("connect-src 'none'");
    expect(csp()).toContain("frame-src 'none'");
    // Remote URLs are still stripped from the markup.
    expect(doc()).not.toContain("static-img");
  });

  it("switches back to strict from the same control", () => {
    const { container, frame, doc } = setup({ sanitization: "relaxed" });

    // The global preference starts the preview in relaxed mode.
    expect(frame().getAttribute("sandbox")).toBe("allow-scripts");

    fireEvent.click(
      within(container).getByRole("button", { name: "Strict" })
    );

    expect(frame().getAttribute("sandbox")).toBe("");
    expect(doc()).not.toMatch(/<script\b/i);
  });

  it("allows external resources and connections in relaxed mode when the setting is on", () => {
    const { csp, doc } = setup({ loadExternal: true, sanitization: "relaxed" });

    expect(csp()).toContain("script-src * 'unsafe-inline' 'unsafe-eval'");
    expect(csp()).toContain("connect-src *");
    expect(csp()).toContain("img-src * data: blob:");
    expect(doc()).toContain("static-img");
  });

  it("keeps passive external resources strict but scriptless", () => {
    const { csp, doc } = setup({ loadExternal: true, sanitization: "strict" });

    expect(csp()).toContain("script-src 'none'");
    expect(csp()).toContain("img-src * data: blob:");
    expect(doc()).not.toMatch(/<script\b/i);
  });

  it("strips meta refresh", () => {
    settings = { html_load_external: false, html_sanitization: "relaxed" };
    const { container } = render(
      <SandboxedHtmlPreview
        content={`<meta http-equiv="refresh" content="0;url=http://127.0.0.1:8000/refresh">${DOCUMENT}`}
        title="preview"
      />
    );

    expect(container.querySelector("iframe").getAttribute("srcdoc")).not.toMatch(
      /http-equiv\s*=\s*["']?refresh/i
    );
  });
});
