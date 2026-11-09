import { describe, expect, it } from "vitest";
import { markdownToDocx } from "../docx";

describe("markdownToDocx", () => {
  it("creates a non-empty docx archive", async () => {
    const bytes = await markdownToDocx("# Title\n\nHello **world**.\n\n- one\n- two", "Test");
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(1000);
    // DOCX is a ZIP archive.
    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });
});
