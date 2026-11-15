import { describe, expect, it } from "vitest";
import { rendererComponents } from "../MarkdownRenderer";

const preFor = (className) =>
  rendererComponents.pre({
    children: (
      <code className={className} data-testid="code">
        body
      </code>
    ),
  });

/**
 * Fenced blocks that draw their own UI must not be wrapped in <pre>: the
 * wrapper hands them monospace text and `white-space: pre`, which clips prose
 * (the WASM download prompt) on narrow screens instead of wrapping it.
 */
describe("MarkdownRenderer pre wrapper", () => {
  it.each(["html", "latex", "tex", "typst", "typ"])(
    "does not wrap a %s block in <pre>",
    (language) => {
      expect(preFor(`language-${language}`).type).not.toBe("pre");
    }
  );

  it("still wraps ordinary code fences in <pre>", () => {
    expect(preFor("language-json").type).toBe("pre");
    expect(preFor(undefined).type).toBe("pre");
  });
});
