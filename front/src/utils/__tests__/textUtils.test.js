import { describe, expect, it } from "vitest";
import { decodeBase64UrlUtf8, encodeBase64UrlUtf8 } from "../base64url";
import { extractMessageText, conversationSummarySignature } from "../conversationSummary";
import { stripThinking } from "../thinking";
import { dataURLtoFile, getFileType } from "../attachments";

describe("text and file helpers", () => {
  it("round-trips unicode through base64url", () => {
    const value = "Hallo Welt — 你好 🚀";
    expect(decodeBase64UrlUtf8(encodeBase64UrlUtf8(value))).toBe(value);
  });

  it("strips closed and open thinking blocks", () => {
    expect(stripThinking("a<think>secret</think>b")).toBe("ab");
    expect(stripThinking("a<think>still thinking")).toBe("a");
  });

  it("extracts text from message content", () => {
    expect(
      extractMessageText({
        content: [
          { type: "text", text: "one" },
          { type: "file", fileId: "f" },
          { type: "text", text: "two" },
        ],
      }),
    ).toBe("one\ntwo");
  });

  it("changes the summary signature when text changes", () => {
    const first = conversationSummarySignature([
      { role: "user", content: [{ type: "text", text: "one" }] },
    ]);
    const second = conversationSummarySignature([
      { role: "user", content: [{ type: "text", text: "two" }] },
    ]);
    expect(first).not.toBe(second);
  });

  it("detects file types from MIME type and extension", () => {
    expect(getFileType({ type: "image/png", name: "x.png" })).toBe("image");
    expect(getFileType({ type: "", name: "script.py" })).toBe("code");
    expect(getFileType({ type: "text/markdown", name: "x.md" })).toBe("markdown");
    expect(getFileType({ type: "", name: "x.unknown" })).toBe("unknown");
  });

  it("converts data URLs to files", () => {
    const file = dataURLtoFile("data:text/plain;base64,aGVsbG8=", "hello", "text/plain");
    expect(file.name).toBe("hello.plain");
    expect(file.type).toBe("text/plain");
  });
});
