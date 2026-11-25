import { describe, expect, it } from "vitest";

import { preprocessLaTeX } from "../MarkdownRenderer";

describe("preprocessLaTeX", () => {
  it("leaves fenced code untouched, backtick and tilde alike", () => {
    const backtick = "```\nprint('\\\\(x\\\\)')\n```";
    const tilde = "~~~\nprint('\\\\(x\\\\)')\n~~~";

    expect(preprocessLaTeX(backtick)).toBe(backtick);
    expect(preprocessLaTeX(tilde)).toBe(tilde);
  });

  it("leaves inline code untouched", () => {
    expect(preprocessLaTeX("use `\\(` to open a group")).toBe(
      "use `\\(` to open a group",
    );
  });

  it("still converts inline LaTeX outside code", () => {
    expect(preprocessLaTeX("Euler: \\(e^{i\\pi}+1=0\\)")).toBe(
      "Euler: $e^{i\\pi}+1=0$",
    );
  });
});
