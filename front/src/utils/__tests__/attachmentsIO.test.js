import { describe, expect, it } from "vitest";
import { readFileAsBase64, readFileAsText } from "../attachments";

describe("attachment readers", () => {
  it("reads files as text and data URLs", async () => {
    const file = new File(["hello"], "a.txt", { type: "text/plain" });
    await expect(readFileAsText(file)).resolves.toBe("hello");
    await expect(readFileAsBase64(file)).resolves.toMatch(/^data:text\/plain;base64,/);
  });
});
