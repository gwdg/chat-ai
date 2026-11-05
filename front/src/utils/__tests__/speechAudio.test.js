import { describe, expect, it } from "vitest";
import {
  resolveSpeechLanguage,
  toSpeechText,
  splitSpeechText,
} from "../speechAudio";
import { normalizeSpeechVoice, getVoiceLanguage } from "../../config/speechVoices";

describe("speech helpers", () => {
  it("resolves the speech language", () => {
    expect(resolveSpeechLanguage("auto")).toBeNull();
    expect(resolveSpeechLanguage("de-DE")).toBe("de");
    expect(resolveSpeechLanguage("EN-gb")).toBe("en");
  });

  it("normalizes legacy and unknown voices", () => {
    expect(normalizeSpeechVoice("en-us-female")).toBe("af_bella");
    expect(normalizeSpeechVoice("unknown")).toBe("auto");
    expect(getVoiceLanguage("bm_george")).toBe("en-GB");
  });

  it("removes markdown and thinking from speech text", () => {
    const text = toSpeechText(
      "**Hello** [world](https://example.com) `code`  thinkingsecret</think>\n```js\nx\n```",
    );
    expect(text).toBe("Hello world code");
  });

  it("splits long text into chunks under the limit", () => {
    const chunks = splitSpeechText("One. Two! Three? Four.", 10);
    expect(chunks.every((chunk) => chunk.length <= 10)).toBe(true);
    expect(chunks.join(" ")).toContain("One.");
    expect(chunks.join(" ")).toContain("Four.");
  });
});
