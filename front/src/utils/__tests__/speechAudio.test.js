import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_TTS_SAMPLE_RATE,
  encodeWav,
  getSpeechModule,
  resolveSpeechLanguage,
  resolveTtsConfig,
  splitSpeechText,
  toSpeechText,
} from "../speechAudio";
import { normalizeSpeechVoice, getVoiceLanguage } from "../../config/speechVoices";

const originalSpeech = import.meta.env.VITE_MODULE_SPEECH;

afterEach(() => {
  import.meta.env.VITE_MODULE_SPEECH = originalSpeech;
});

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

  it("parses the speech module and TTS config", () => {
    import.meta.env.VITE_MODULE_SPEECH = JSON.stringify({
      model: "kokoro",
      voice: "af_sarah",
    });
    expect(getSpeechModule()).toEqual({ model: "kokoro", voice: "af_sarah" });
    expect(
      resolveTtsConfig({ audio: { voice: "auto", language: "auto" } }, "de-DE"),
    ).toEqual({
      module: { model: "kokoro", voice: "af_sarah" },
      model: "kokoro",
      voice: "af_sarah",
      language: "de",
    });
  });

  it("returns null for malformed or disabled speech modules", () => {
    import.meta.env.VITE_MODULE_SPEECH = "false";
    expect(getSpeechModule()).toBeNull();
    import.meta.env.VITE_MODULE_SPEECH = "not-json";
    expect(getSpeechModule()).toBeNull();
  });

  it("removes markdown and thinking from speech text", () => {
    const text = toSpeechText(
      "**Hello** [world](https://example.com) `code`  thinkingsecret</think>\n```js\nx\n```",
    );
    expect(text).toBe("Hello world code");
  });

  it("clips long speech text at a sentence boundary", () => {
    const text = toSpeechText("First sentence. Second sentence. Third sentence.", 20);
    expect(text.length).toBeLessThanOrEqual(20);
  });

  it("splits long text into chunks under the limit", () => {
    const chunks = splitSpeechText("One. Two! Three? Four.", 10);
    expect(chunks.every((chunk) => chunk.length <= 10)).toBe(true);
    expect(chunks.join(" ")).toContain("One.");
    expect(chunks.join(" ")).toContain("Four.");
    expect(splitSpeechText("   ")).toEqual([]);
  });

  it("encodes PCM chunks as a WAV blob", async () => {
    const blob = encodeWav([new Float32Array([0, 0.5, -0.5])], DEFAULT_TTS_SAMPLE_RATE);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(blob.type).toBe("audio/wav");
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("RIFF");
    expect(new TextDecoder().decode(bytes.slice(8, 12))).toBe("WAVE");
  });
});
