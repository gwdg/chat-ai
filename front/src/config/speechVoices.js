export const AUTO_VOICE = "auto";
export const AUTO_LANGUAGE = "auto";

export const SPEECH_VOICE_OPTIONS = [
  { value: AUTO_VOICE, labelKey: "settings.audio_option_auto", lang: null },
  { value: "af_bella", labelKey: "settings.audio_voice_af_bella", lang: "en-US" },
  { value: "af_nicole", labelKey: "settings.audio_voice_af_nicole", lang: "en-US" },
  { value: "af_sarah", labelKey: "settings.audio_voice_af_sarah", lang: "en-US" },
  { value: "am_adam", labelKey: "settings.audio_voice_am_adam", lang: "en-US" },
  { value: "am_michael", labelKey: "settings.audio_voice_am_michael", lang: "en-US" },
  { value: "bf_emma", labelKey: "settings.audio_voice_bf_emma", lang: "en-GB" },
  { value: "bm_george", labelKey: "settings.audio_voice_bm_george", lang: "en-GB" },
  { value: "bm_lewis", labelKey: "settings.audio_voice_bm_lewis", lang: "en-GB" },
];

export const SPEECH_LANGUAGE_OPTIONS = [
  { value: AUTO_LANGUAGE, labelKey: "settings.audio_option_auto" },
  { value: "en", labelKey: "settings.audio_language_english" },
  { value: "de", labelKey: "settings.audio_language_german" },
];

const LEGACY_VOICES = {
  "en-us-female": "af_bella",
  "en-us-male": "am_adam",
  "en-uk-female": "bf_emma",
  "en-uk-male": "bm_george",
};

export function normalizeSpeechVoice(voice) {
  if (!voice || voice === AUTO_VOICE) return AUTO_VOICE;
  if (SPEECH_VOICE_OPTIONS.some((option) => option.value === voice)) {
    return voice;
  }
  return LEGACY_VOICES[voice] || AUTO_VOICE;
}

export function getVoiceLanguage(voice) {
  return SPEECH_VOICE_OPTIONS.find((option) => option.value === voice)?.lang || null;
}
