import { AUTO_VOICE, normalizeSpeechVoice } from "../config/speechVoices";

export const DEFAULT_TTS_SAMPLE_RATE = 16000;

export function getSpeechModule() {
  const raw = import.meta.env?.VITE_MODULE_SPEECH;
  if (!raw || raw === "undefined" || raw === "false") return null;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (parsed && typeof parsed === "object" && parsed.model && parsed.voice) {
      return parsed;
    }
  } catch (error) {
    console.warn("Could not parse the speech module configuration.", error);
  }
  return null;
}

export function resolveSpeechLanguage(language) {
  if (!language || language === "auto") return null;
  return String(language).split("-")[0].toLowerCase();
}

export function resolveTtsConfig(settings, i18nLanguage = "en") {
  const speechModule = getSpeechModule();
  const audio = settings?.audio || {};
  const uiLanguage = String(i18nLanguage || "en").split("-")[0].toLowerCase();
  return {
    module: speechModule,
    model: audio.model || speechModule?.model || null,
    voice:
      normalizeSpeechVoice(audio.voice) !== AUTO_VOICE
        ? normalizeSpeechVoice(audio.voice)
        : speechModule?.voice || null,
    language:
      resolveSpeechLanguage(audio.language) || (uiLanguage === "de" ? "de" : "en"),
  };
}

function concatenate(chunks) {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const merged = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

function resample(samples, inputRate, outputRate) {
  if (inputRate === outputRate || samples.length === 0) return samples;
  const ratio = inputRate / outputRate;
  const length = Math.max(1, Math.floor(samples.length / ratio));
  const output = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const position = i * ratio;
    const index = Math.floor(position);
    const fraction = position - index;
    const a = samples[index] ?? 0;
    const b = samples[index + 1] ?? a;
    output[i] = a + (b - a) * fraction;
  }
  return output;
}

export function encodeWav(
  chunks,
  inputSampleRate,
  targetSampleRate = DEFAULT_TTS_SAMPLE_RATE
) {
  const merged = concatenate(chunks);
  const samples = resample(merged, inputSampleRate, targetSampleRate);
  const bytesPerSample = 2;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);

  const writeString = (offset, value) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, targetSampleRate, true);
  view.setUint32(28, targetSampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples.length * bytesPerSample, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += bytesPerSample;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

export function toSpeechText(markdown, maxChars = 6000) {
  if (typeof markdown !== "string") return "";
  let text = markdown
    .replace(/[\u200b\u200c\u200d]?think[\s\S]*?<\/think>/gi, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/~~~[\s\S]*?~~~/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/[*_~]{1,3}/g, "")
    .replace(/\|/g, ", ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length > maxChars) {
    const clipped = text.slice(0, maxChars);
    const lastStop = Math.max(
      clipped.lastIndexOf(". "),
      clipped.lastIndexOf("! "),
      clipped.lastIndexOf("? ")
    );
    text = lastStop > maxChars * 0.5 ? clipped.slice(0, lastStop + 1) : clipped;
  }
  return text.trim();
}

export function splitSpeechText(text, maxChars = 900) {
  const normalized = (text || "").trim();
  if (!normalized) return [];
  const sentences = normalized.match(/[^.!?…]+[.!?…]+[\])'"”’]?\s*|[^.!?…]+$/g) || [
    normalized,
  ];
  const chunks = [];
  let current = "";

  const pushCurrent = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };

  for (const sentence of sentences) {
    const next = `${current}${sentence}`.trim();
    if (next.length <= maxChars) {
      current = next;
      continue;
    }
    pushCurrent();
    if (sentence.length <= maxChars) {
      current = sentence;
      continue;
    }
    const words = sentence.split(/\s+/);
    for (const word of words) {
      const candidate = `${current} ${word}`.trim();
      if (candidate.length > maxChars && current) {
        chunks.push(current.trim());
        current = word;
      } else {
        current = candidate;
      }
    }
  }
  pushCurrent();
  return chunks;
}
