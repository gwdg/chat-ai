import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Play, Square } from "lucide-react";

import generateAudio from "../../apis/generateAudio";
import {
  AUTO_LANGUAGE,
  AUTO_VOICE,
  SPEECH_LANGUAGE_OPTIONS,
  SPEECH_VOICE_OPTIONS,
  normalizeSpeechVoice,
} from "../../config/speechVoices";
import { getSpeechModule, resolveTtsConfig } from "../../utils/speechAudio";

function browserSpeak(text, language) {
  if (!window.speechSynthesis) return null;
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === "de" ? "de-DE" : "en-US";
    const voices = window.speechSynthesis.getVoices?.() || [];
    const match = voices.find((voice) =>
      voice.lang?.toLowerCase().startsWith(language.toLowerCase())
    );
    if (match) utterance.voice = match;
    utterance.onend = () => resolve(true);
    utterance.onerror = () => resolve(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  });
}

export default function AudioSettingsContainer({ localState, setLocalState }) {
  const { t, i18n } = useTranslation();
  const speechModule = getSpeechModule();
  const settings = localState?.settings || {};
  const audio = settings.audio || {};
  const voiceValue = normalizeSpeechVoice(audio.voice) || AUTO_VOICE;
  const languageValue = audio.language || AUTO_LANGUAGE;

  const [previewing, setPreviewing] = useState(false);
  const cancelRef = useRef(false);
  const audioRef = useRef(null);
  const urlRef = useRef(null);

  const voiceOptions = useMemo(
    () =>
      SPEECH_VOICE_OPTIONS.map((option) => ({
        ...option,
        label: t(option.labelKey),
      })),
    [t]
  );
  const languageOptions = useMemo(
    () =>
      SPEECH_LANGUAGE_OPTIONS.map((option) => ({
        ...option,
        label: t(option.labelKey),
      })),
    [t]
  );

  const stopPreview = () => {
    cancelRef.current = true;
    if (audioRef.current) {
      audioRef.current.pause?.();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    window.speechSynthesis?.cancel();
    setPreviewing(false);
  };

  useEffect(() => stopPreview, []);

  const updateAudioSetting = (key, value) => {
    setLocalState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        audio: {
          ...(prev.settings?.audio || {}),
          [key]: value,
        },
      },
      flush: true,
    }));
  };

  const handlePreview = async () => {
    if (previewing) {
      stopPreview();
      return;
    }
    cancelRef.current = false;
    setPreviewing(true);
    const config = resolveTtsConfig(
      {
        ...settings,
        audio: { ...audio, voice: voiceValue, language: languageValue },
      },
      i18n?.language
    );
    const text =
      config.language === "de"
        ? t("settings.audio_sample_text_de")
        : t("settings.audio_sample_text_en");

    let file = null;
    if (config.model && config.voice) {
      file = await generateAudio(
        text,
        config.model,
        config.voice,
        20000,
        config.language
      );
    }
    if (cancelRef.current) return;
    if (!file) {
      const ok = await browserSpeak(text, config.language);
      if (!cancelRef.current) setPreviewing(false);
      if (!ok) setPreviewing(false);
      return;
    }
    const url = URL.createObjectURL(file);
    urlRef.current = url;
    const audioElement = new Audio(url);
    audioRef.current = audioElement;
    const finish = () => {
      if (urlRef.current === url) {
        URL.revokeObjectURL(url);
        urlRef.current = null;
      }
      audioRef.current = null;
      setPreviewing(false);
    };
    audioElement.onended = finish;
    audioElement.onerror = finish;
    audioElement.play().catch(finish);
  };

  if (!speechModule) {
    return (
      <div className="text-sm text-base-content/60">
        {t("settings.audio_unavailable")}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{t("settings.audio_title")}</p>
        <p className="text-xs text-base-content/60">{t("settings.audio_description")}</p>
      </div>
      <label className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 w-full">
        <span className="text-sm sm:w-28 shrink-0">{t("settings.label_audio_voice")}</span>
        <div className="flex gap-2 items-center w-full">
          <select
            value={voiceValue}
            onChange={(event) => updateAudioSetting("voice", event.target.value)}
            className="select select-bordered select-sm w-full"
          >
            {voiceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handlePreview}
            className="btn btn-sm btn-square shrink-0"
            title={
              previewing
                ? t("settings.audio_preview_stop")
                : t("settings.audio_preview")
            }
            aria-label={
              previewing
                ? t("settings.audio_preview_stop")
                : t("settings.audio_preview")
            }
          >
            {previewing ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
        </div>
      </label>
      <label className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 w-full">
        <span className="text-sm sm:w-28 shrink-0">{t("settings.label_audio_language")}</span>
        <select
          value={languageValue}
          onChange={(event) => updateAudioSetting("language", event.target.value)}
          className="select select-bordered select-sm w-full"
        >
          {languageOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
