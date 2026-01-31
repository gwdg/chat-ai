// components/settings/AudioSettingsContainer.jsx
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Play, Square } from "lucide-react";

const AUTO_VALUE = "auto";

const AudioSettingsContainer = ({ localState, setLocalState }) => {
  const { t, i18n } = useTranslation();
  const settings = localState?.settings || {};
  const audioSettings = settings.audio || {};
  const autoLabelRaw = t("settings.audio_option_auto");
  const autoLabel = autoLabelRaw && autoLabelRaw.trim().length > 0 ? autoLabelRaw : "Auto";

  const voiceValue = audioSettings.voice || AUTO_VALUE;
  const languageValue = audioSettings.language || AUTO_VALUE;

  const languageOptions = useMemo(
    () => [
      { value: AUTO_VALUE, label: autoLabel },
      { value: "en", label: t("settings.audio_language_english") },
      { value: "de", label: t("settings.audio_language_german") },
    ],
    [autoLabel, t]
  );

  const voiceOptions = useMemo(
    () => [
      { value: AUTO_VALUE, label: autoLabel, lang: null, gender: null },
      { value: "en-us-female", label: t("settings.audio_voice_english_us_female"), lang: "en-US", gender: "female" },
      { value: "en-us-male", label: t("settings.audio_voice_english_us_male"), lang: "en-US", gender: "male" },
      { value: "en-uk-female", label: t("settings.audio_voice_english_uk_female"), lang: "en-GB", gender: "female" },
      { value: "en-uk-male", label: t("settings.audio_voice_english_uk_male"), lang: "en-GB", gender: "male" },
      { value: "de-female", label: t("settings.audio_voice_german_female"), lang: "de-DE", gender: "female" },
      { value: "de-male", label: t("settings.audio_voice_german_male"), lang: "de-DE", gender: "male" },
    ],
    [autoLabel, t]
  );

  const safeLanguageValue = languageOptions.some((option) => option.value === languageValue)
    ? languageValue
    : AUTO_VALUE;

  const [speechVoices, setSpeechVoices] = useState([]);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const speechSupported =
    typeof window !== "undefined" && typeof window.speechSynthesis !== "undefined";

  useEffect(() => {
    if (!speechSupported) return undefined;

    const handleVoicesChanged = () => {
      const voices = window.speechSynthesis.getVoices();
      setSpeechVoices(Array.isArray(voices) ? voices : []);
    };

    handleVoicesChanged();
    window.speechSynthesis.addEventListener("voiceschanged", handleVoicesChanged);

    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", handleVoicesChanged);
    };
  }, [speechSupported]);

  useEffect(() => {
    return () => {
      if (speechSupported) {
        window.speechSynthesis.cancel();
      }
    };
  }, [speechSupported]);

  const matchesLanguage = (voice, lang) => {
    if (!voice?.lang || !lang) return false;
    const voiceLang = voice.lang.toLowerCase();
    const normalizedLang = lang.toLowerCase();
    return voiceLang === normalizedLang || voiceLang.startsWith(normalizedLang.slice(0, 2));
  };

  const matchesGenderHint = (voice, gender) => {
    if (!gender) return true;
    const maleHints = ["male", "man", "masculine", "männ", "mnn", "herr", "guy"];
    const femaleHints = ["female", "woman", "feminine", "weib", "frau", "girl"];
    const hintList = gender === "male" ? maleHints : femaleHints;
    const name = `${voice?.name || ""} ${voice?.voiceURI || ""}`.toLowerCase();
    return hintList.some((hint) => name.includes(hint));
  };

  const hasGenderVoice = (lang, gender) => {
    if (!speechSupported) return false;
    if (!Array.isArray(speechVoices) || speechVoices.length === 0) return false;
    return speechVoices.some(
      (voice) => matchesLanguage(voice, lang) && matchesGenderHint(voice, gender)
    );
  };

  const voiceOptionsWithAvailability = useMemo(() => {
    return voiceOptions.map((option) => {
      if (option.value === AUTO_VALUE || !option.gender || !option.lang) {
        return { ...option, available: true };
      }
      const available = hasGenderVoice(option.lang, option.gender);
      return { ...option, available: speechSupported ? available : false };
    });
  }, [voiceOptions, speechSupported, speechVoices]);

  const filteredVoiceOptions = useMemo(() => {
    let options = voiceOptionsWithAvailability;
    if (safeLanguageValue === "de") {
      options = options.filter(
        (option) => option.value === AUTO_VALUE || option.lang?.toLowerCase().startsWith("de")
      );
    }
    if (safeLanguageValue === "en") {
      options = options.filter(
        (option) => option.value === AUTO_VALUE || option.lang?.toLowerCase().startsWith("en")
      );
    }
    return options;
  }, [safeLanguageValue, voiceOptionsWithAvailability]);

  const safeVoiceValue = filteredVoiceOptions.some((option) => option.value === voiceValue)
    ? voiceValue
    : AUTO_VALUE;

  const selectedVoiceOption = voiceOptionsWithAvailability.find(
    (option) => option.value === safeVoiceValue
  );
  const selectedVoiceUnavailable =
    selectedVoiceOption?.value !== AUTO_VALUE && selectedVoiceOption?.available === false;

  const handleAudioChange = (key) => (e) => {
    const value = e.target.value;
    setLocalState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        audio: {
          ...prev.settings?.audio,
          [key]: value,
        },
      },
    }));
  };

  const selectClassName =
    "dark:text-white text-black bg-white dark:bg-bg_secondary_dark border dark:border-border_dark outline-none rounded-lg shadow-lg dark:shadow-dark w-full h-10 px-4 text-sm cursor-pointer";

  const previewButtonClassName = [
    "h-10 w-10 rounded-lg border flex items-center justify-center",
    "bg-white dark:bg-bg_secondary_dark dark:border-border_dark",
    speechSupported
      ? "hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-tertiary"
      : "opacity-50 cursor-not-allowed text-gray-400",
  ].join(" ");

  const resolveSampleLang = () => {
    const voiceOption = voiceOptions.find((option) => option.value === safeVoiceValue);
    if (voiceOption?.lang) return voiceOption.lang;
    if (safeLanguageValue === "de") return "de-DE";
    if (safeLanguageValue === "en") return "en-US";
    const uiLang = i18n?.resolvedLanguage || i18n?.language || "en";
    return uiLang.startsWith("de") ? "de-DE" : "en-US";
  };

  const resolveSampleText = (lang) => {
    return lang?.toLowerCase().startsWith("de")
      ? t("settings.audio_sample_text_de")
      : t("settings.audio_sample_text_en");
  };

  const resolveVoice = (lang) => {
    if (!speechSupported) return null;
    if (safeVoiceValue === AUTO_VALUE) return null;
    if (!Array.isArray(speechVoices) || speechVoices.length === 0) return null;
    const voiceOption = voiceOptions.find((option) => option.value === safeVoiceValue);
    const desiredGender = voiceOption?.gender;
    if (!lang) return speechVoices[0] || null;
    const normalizedLang = lang.toLowerCase();
    const langVoices = speechVoices.filter((voice) => matchesLanguage(voice, normalizedLang));

    if (!desiredGender) {
      return langVoices[0] || speechVoices[0] || null;
    }

    const matchByHint = (voice) => {
      return matchesGenderHint(voice, desiredGender);
    };

    return (
      langVoices.find(matchByHint) ||
      speechVoices.find(matchByHint) ||
      langVoices[0] ||
      speechVoices[0] ||
      null
    );
  };

  const handlePreview = () => {
    if (!speechSupported) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const sampleLang = resolveSampleLang();
    const sampleText = resolveSampleText(sampleLang);
    const utterance = new SpeechSynthesisUtterance(sampleText);
    utterance.lang = sampleLang;
    const selectedVoice = resolveVoice(sampleLang);
    if (selectedVoice) utterance.voice = selectedVoice;
    const desiredGender = voiceOptions.find((option) => option.value === safeVoiceValue)?.gender;
    if (desiredGender === "male") {
      utterance.pitch = 0.8;
      utterance.rate = 0.95;
    } else if (desiredGender === "female") {
      utterance.pitch = 1.15;
      utterance.rate = 1.02;
    }
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex gap-3 w-full items-center">
        <div className="flex-shrink-0 flex items-center gap-2 select-none">
          <p className="text-sm">{t("settings.label_audio_voice")}</p>
        </div>
        <div className="w-full flex gap-2 items-center">
          <select
            value={safeVoiceValue}
            onChange={handleAudioChange("voice")}
            className={selectClassName}
          >
            {filteredVoiceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handlePreview}
            className={previewButtonClassName}
            aria-label={
              speechSupported ? t("settings.audio_preview") : t("settings.audio_preview_unavailable")
            }
            title={
              speechSupported ? t("settings.audio_preview") : t("settings.audio_preview_unavailable")
            }
          >
            {isSpeaking ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {speechSupported && selectedVoiceUnavailable && (
        <div className="text-xs text-yellow-600 select-none">
          {t("settings.audio_voice_unavailable")}
        </div>
      )}

      <div className="flex gap-3 w-full items-center">
        <div className="flex-shrink-0 flex items-center gap-2 select-none">
          <p className="text-sm">{t("settings.label_audio_language")}</p>
        </div>
        <div className="w-full flex">
          <select
            value={safeLanguageValue}
            onChange={handleAudioChange("language")}
            className={selectClassName}
          >
            {languageOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default AudioSettingsContainer;
