import { describe, expect, it } from "vitest";
import { formatLatexError } from "../tikzRenderer";

describe("formatLatexError", () => {
  it("extracts the first TeX error without the interactive prompt", () => {
    const log = [
      "This is e-TeX, Version 3.141592653-2.6",
      "! Dimension too large.",
      "<recently read> \\pgfmath@x",
      "l.39   }",
      "? \\end",
      "! Emergency stop.",
    ].join("\n");

    expect(formatLatexError(log)).toBe(
      "! Dimension too large.\n<recently read> \\pgfmath@x\nl.39   }"
    );
  });

  it("keeps non-TeX error messages", () => {
    expect(formatLatexError("TikZ rendering failed")).toBe("TikZ rendering failed");
  });
});
