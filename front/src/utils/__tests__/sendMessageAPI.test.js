import { beforeEach, describe, expect, it } from "vitest";
import { db, saveFileReady } from "../../db";
import {
  buildConversationForAPI,
  processContentItems,
} from "../sendMessage";

const clearFiles = () =>
  db.transaction("rw", [db.files_meta, db.files_data], async () => {
    await Promise.all([db.files_meta.clear(), db.files_data.clear()]);
  });

const save = (name, type, content = "hello") =>
  saveFileReady("chat-1", new File([content], name, { type }));

describe("processContentItems", () => {
  beforeEach(async () => {
    await clearFiles();
  });

  it("returns plain text directly", async () => {
    await expect(
      processContentItems({ items: [{ type: "text", text: "hello" }] }),
    ).resolves.toBe("hello");
  });

  it("drops forms and empty text", async () => {
    const result = await processContentItems({
      items: [
        { type: "text", text: "" },
        { type: "form", form: { title: "Form" } },
        { type: "text", text: "visible" },
      ],
    });
    expect(result).toBe("visible");
  });

  it("sends images as data URLs", async () => {
    const fileId = await save("image.png", "image/png");
    const result = await processContentItems({
      items: [{ type: "text", text: "look" }, { type: "file", fileId }],
    });
    expect(result).toEqual([
      { type: "text", text: "look" },
      { type: "image_url", image_url: { url: expect.stringContaining("data:image/png") } },
    ]);
  });

  it("sends audio without its data URL prefix", async () => {
    const fileId = await save("audio.wav", "audio/wav");
    const result = await processContentItems({
      items: [{ type: "file", fileId }],
    });
    expect(result[0]).toMatchObject({
      type: "input_audio",
      input_audio: { format: "wav" },
    });
    expect(result[0].input_audio.data).not.toContain("data:");
  });

  it("converts text files to text and skips PDFs", async () => {
    const textId = await save("notes.txt", "text/plain", "contents");
    const pdfId = await save("doc.pdf", "application/pdf", "pdf");
    const result = await processContentItems({
      items: [
        { type: "text", text: "read" },
        { type: "file", fileId: textId },
        { type: "file", fileId: pdfId },
      ],
    });
    expect(result).toEqual([
      { type: "text", text: "read" },
      { type: "text", text: "contents" },
    ]);
  });

  it("skips ignored and missing files", async () => {
    const imageId = await save("image.png", "image/png");
    const result = await processContentItems({
      items: [
        { type: "text", text: "x" },
        { type: "file", fileId: imageId },
        { type: "file", fileId: "missing" },
      ],
      ignoreImages: true,
    });
    expect(result).toBe("x");
  });

  it("uses the files API when document conversion is off", async () => {
    const fileId = await save("notes.txt", "text/plain", "contents");
    const result = await processContentItems({
      items: [{ type: "text", text: "x" }, { type: "file", fileId }],
      convertDocs: false,
    });
    expect(result[1]).toMatchObject({
      type: "file",
      file: { filename: "notes.txt" },
    });
  });
});

describe("buildConversationForAPI", () => {
  it("copies the conversation and processes content", async () => {
    const localState = {
      settings: { model: { id: "m", input: ["image"] }, enable_tools: false },
      messages: [
        { role: "system", content: [{ type: "text", text: "system" }] },
        { role: "user", content: [{ type: "text", text: "hello" }] },
        { role: "assistant", content: [{ type: "text", text: "hi" }] },
      ],
    };
    const result = await buildConversationForAPI(localState);
    expect(result.messages.map((message) => message.role)).toEqual([
      "system",
      "user",
      "assistant",
    ]);
    expect(result.messages[1].content).toBe("hello");
    expect(result.settings).not.toBe(localState.settings);
  });

  it("uses hidden speech text for empty messages", async () => {
    const localState = {
      settings: { model: { id: "m" }, enable_tools: false },
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: "" }],
          meta: { speechTranscript: "spoken words" },
        },
      ],
    };
    const result = await buildConversationForAPI(localState);
    expect(result.messages[0].content).toBe("spoken words");
  });

  it("marks earlier empty voice messages when forcing audio input", async () => {
    const localState = {
      settings: { model: { id: "m" }, enable_tools: false },
      messages: [
        { role: "user", content: [{ type: "text", text: "" }] },
        { role: "assistant", content: [{ type: "text", text: "answer" }] },
        { role: "user", content: [{ type: "text", text: "" }] },
      ],
    };
    const result = await buildConversationForAPI(localState, { forceAudioInput: true });
    expect(result.messages[0].content).toBe("[voice message]");
  });
});
