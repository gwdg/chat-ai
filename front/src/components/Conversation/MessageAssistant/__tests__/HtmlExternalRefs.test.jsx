import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// MarkdownRenderer reads the HTML preferences through useSelector. Feed it a
// plain state object so each test can pick the render mode / sanitization /
// external-reference combination under test.
let settings = {};
vi.mock("react-redux", () => ({
  useSelector: (selector) =>
    selector({ user_settings: settings, interface_settings: {} }),
}));

import MarkdownRenderer from "../MarkdownRenderer";

// Reproduces the reported block: an external image plus inline script that
// performs three network requests (two local, one remote).
const EGRESS_SNIPPET = `<h3 id="x">Egress demo</h3>
<img src="http://127.0.0.1:8000/static-img">
<script>
  new Image().src = "http://127.0.0.1:8000/img-ping";
  fetch("http://127.0.0.1:8000/fetch-ping");
  fetch("https://jsonplaceholder.typicode.com/todos/1").then(x=>x.text()).then(x => document.getElementById("x").outerHTML += x);
</script>`;

const renderFrame = ({ content, loadExternal, sanitization }) => {
  settings = {
    html_render_mode: "render",
    html_load_external: loadExternal,
    html_sanitization: sanitization,
  };
  const { container, unmount } = render(
    <MarkdownRenderer isLoading={false}>{content}</MarkdownRenderer>
  );
  const iframe = container.querySelector("iframe");
  const result = iframe
    ? {
        html: iframe.getAttribute("srcdoc") || "",
        sandbox: iframe.getAttribute("sandbox") ?? "",
      }
    : {
        html: container.querySelector(".markdown-body")?.innerHTML || "",
        sandbox: null,
      };
  unmount();
  return result;
};

const renderHtml = (options) => renderFrame(options).html;

const fenced = (snippet) => `\`\`\`html\n${snippet}\n\`\`\``;

const extractCsp = (html) => {
  const match = html.match(
    /^<meta http-equiv="Content-Security-Policy" content="([^"]*)">/i
  );
  return match?.[1] || "";
};

// Anything in the rendered output that makes the browser open a connection
// without a user click. The reported snippet only needs these three forms.
const makesNetworkRequest = (html) =>
  /<script\b/i.test(html) ||
  /\bfetch\s*\(/i.test(html) ||
  /new\s+Image\s*\(/i.test(html) ||
  /https?:\/\//i.test(html);

describe("fenced HTML block CSP", () => {
  it("puts the CSP meta before any block content", () => {
    for (const sanitization of ["strict", "relaxed"]) {
      for (const loadExternal of [false, true]) {
        const html = renderHtml({
          content: fenced(EGRESS_SNIPPET),
          loadExternal,
          sanitization,
        });
        expect(html.startsWith("<meta http-equiv=\"Content-Security-Policy\"")).toBe(
          true
        );
        expect(html.indexOf("Content-Security-Policy")).toBeLessThan(
          html.indexOf("Egress demo")
        );
      }
    }
  });

  it("strict + external references off blocks scripts and all network", () => {
    const { html, sandbox } = renderFrame({
      content: fenced(EGRESS_SNIPPET),
      loadExternal: false,
      sanitization: "strict",
    });
    const csp = extractCsp(html);

    expect(sandbox).toBe("");
    expect(csp).toContain("script-src 'none'");
    expect(csp).toContain("connect-src 'none'");
    expect(csp).toMatch(/(?:^|; )img-src data:/);
    expect(csp).not.toMatch(/img-src[^;]*\*/);
    expect(csp).toContain("frame-src 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(html).not.toMatch(/<script\b/i);
  });

  it("relaxed + external references off runs no network despite inline scripts", () => {
    const { html, sandbox } = renderFrame({
      content: fenced(EGRESS_SNIPPET),
      loadExternal: false,
      sanitization: "relaxed",
    });
    const csp = extractCsp(html);

    expect(sandbox).toBe("allow-scripts");
    expect(csp).toContain("script-src 'unsafe-inline' 'unsafe-eval'");
    expect(csp).toContain("connect-src 'none'");
    expect(csp).toMatch(/(?:^|; )img-src data: blob:/);
    expect(csp).not.toMatch(/img-src[^;]*\*/);
    expect(csp).toContain("frame-src 'none'");
    expect(csp).toContain("worker-src blob:");

    // The script text stays (relaxed allows it), but the CSP blocks its
    // fetch()/Image requests, so the browser cannot reach an external host.
    expect(html).toMatch(/<script\b/i);
    expect(html).toMatch(/\bfetch\s*\(/i);
    // URL attributes are still stripped by sanitizeExternalRefs.
    expect(html).not.toMatch(/static-img/);
  });

  it("strict + external references on allows passive resources but no scripts", () => {
    const { html } = renderFrame({
      content: fenced(EGRESS_SNIPPET),
      loadExternal: true,
      sanitization: "strict",
    });
    const csp = extractCsp(html);

    expect(csp).toContain("script-src 'none'");
    expect(csp).toContain("connect-src 'none'");
    expect(csp).toContain("img-src * data: blob:");
    expect(csp).toContain("frame-src 'none'");
    expect(html).toMatch(/static-img/);
  });

  it("relaxed + external references on allows external resources and connections", () => {
    const { html } = renderFrame({
      content: fenced(EGRESS_SNIPPET),
      loadExternal: true,
      sanitization: "relaxed",
    });
    const csp = extractCsp(html);

    expect(csp).toContain("script-src * 'unsafe-inline' 'unsafe-eval'");
    expect(csp).toContain("connect-src *");
    expect(csp).toContain("img-src * data: blob:");
    expect(csp).toContain("frame-src *");
    expect(html).toMatch(/static-img/);
  });

  it("strips meta refresh even in relaxed mode", () => {
    const content = `<meta http-equiv="refresh" content="0;url=http://127.0.0.1:8000/refresh">\n${EGRESS_SNIPPET}`;
    const html = renderHtml({
      content: fenced(content),
      loadExternal: false,
      sanitization: "relaxed",
    });

    expect(html).not.toMatch(/http-equiv\s*=\s*["']?refresh/i);
  });
});

describe("raw HTML block policy", () => {
  it("always sanitizes raw HTML strictly, even when relaxed is selected", () => {
    const html = renderHtml({
      content: EGRESS_SNIPPET,
      loadExternal: false,
      sanitization: "relaxed",
    });

    expect(html).not.toMatch(/<script\b/i);
    expect(html).not.toMatch(/https?:\/\//i);
    expect(makesNetworkRequest(html)).toBe(false);
  });
});
