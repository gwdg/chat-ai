// components/settings/AudioSettingsContainer.jsx
import { useTranslation } from "react-i18next";

const AUTO_VALUE = "auto";

const normalizeOption = (option) => {
  if (!option) return null;
  if (typeof option === "string") {
    return { value: option, label: option };
  }
  if (typeof option === "object") {
    const value = option.value ?? option.id ?? option.code ?? option.name;
    const label = option.label ?? option.name ?? option.id ?? option.code ?? option.value;
    if (!value) return null;
    return { value: String(value), label: String(label || value) };
  }
  return null;
};

const buildOptions = (rawOptions, autoLabel, currentValue) => {
  const options = [{ value: AUTO_VALUE, label: autoLabel }];
  const list = Array.isArray(rawOptions) ? rawOptions : [];

  list.forEach((option) => {
    const normalized = normalizeOption(option);
    if (normalized) options.push(normalized);
  });

  if (currentValue && !options.some((option) => option.value === currentValue)) {
    options.push({ value: currentValue, label: currentValue });
  }

  const seen = new Set();
  return options.filter((option) => {
    if (!option?.value) return false;
    if (seen.has(option.value)) return false;
    seen.add(option.value);
    return true;
  });
};

const AudioSettingsContainer = ({ localState, setLocalState }) => {
  const { t } = useTranslation();
  const settings = localState?.settings || {};
  const model = typeof settings.model === "object" && settings.model !== null ? settings.model : {};
  const audioSettings = settings.audio || {};
  const autoLabelRaw = t("settings.audio_option_auto");
  const autoLabel = autoLabelRaw && autoLabelRaw.trim().length > 0 ? autoLabelRaw : "Auto";

  const voiceValue = audioSettings.voice || AUTO_VALUE;
  const languageValue = audioSettings.language || AUTO_VALUE;

  const modelAudio = model.audio || {};
  const voiceOptions = buildOptions(
    Array.isArray(modelAudio.voices) ? modelAudio.voices : model.voices,
    autoLabel,
    voiceValue
  );
  const languageOptions = buildOptions(
    Array.isArray(modelAudio.languages) ? modelAudio.languages : model.languages,
    autoLabel,
    languageValue
  );

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

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex gap-3 w-full items-center">
        <div className="flex-shrink-0 flex items-center gap-2 select-none">
          <p className="text-sm">{t("settings.label_audio_voice")}</p>
        </div>
        <div className="w-full flex">
          <select
            value={voiceValue}
            onChange={handleAudioChange("voice")}
            className={selectClassName}
          >
            {voiceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-3 w-full items-center">
        <div className="flex-shrink-0 flex items-center gap-2 select-none">
          <p className="text-sm">{t("settings.label_audio_language")}</p>
        </div>
        <div className="w-full flex">
          <select
            value={languageValue}
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
