import { HelpCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import {
  selectMemoryMode,
  selectSetTitleOnce,
  selectSuggestUserPrompts,
  setMemoryMode,
  setSetTitleOnce,
  selectRenderLatex,
  selectRenderTypst,
  setRenderLatex,
  setRenderTypst,
  setSuggestUserPrompts,
  selectHtmlPreview,
  setHtmlPreview,
  selectDocumentConversionMode,
  setDocumentConversionMode,
} from "../../Redux/reducers/userSettingsReducer";
import {
  selectDisableScreensavers,
  setDisableScreensavers,
} from "../../Redux/reducers/interfaceSettingsSlice";
import { useModal } from "../ModalContext";
import ProfilePreferenceSwitch from "./ProfilePreferenceSwitch";

const MEMORY_OPTIONS = [
  { value: 0, key: "none" },
  { value: 1, key: "recall" },
  { value: 2, key: "learn" },
];

const HTML_PREVIEW_OPTIONS = ["off", "static", "ask"];

const DOCUMENT_CONVERSION_OPTIONS = [
  { value: "server", key: "server" },
  { value: "browser", key: "browser" },
];

export function MemoryPreference() {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { openModal } = useModal();
  const memoryMode = useSelector(selectMemoryMode);
  const selectedMemoryOption =
    MEMORY_OPTIONS.find((option) => option.value === memoryMode) ??
    MEMORY_OPTIONS[0];

  return (
    <section className="flex flex-col gap-2">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <h3
            id="global-memory-mode-label"
            className="text-sm font-medium text-gray-900 dark:text-white"
          >
            {t("user_settings.chat_preferences.memory.label")}
          </h3>
          <button
            type="button"
            onClick={() => openModal("helpMemory")}
            aria-label={t(
              "user_settings.chat_preferences.memory.help_label",
            )}
            title={t("user_settings.chat_preferences.memory.help_label")}
            className="rounded-md p-1 text-tertiary transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tertiary/50 dark:hover:bg-gray-800"
          >
            <HelpCircle className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          {t("user_settings.chat_preferences.memory.description")}
        </p>
      </div>

      <div
        role="group"
        aria-labelledby="global-memory-mode-label"
        className="grid min-h-10 grid-cols-3 gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800/60"
      >
        {MEMORY_OPTIONS.map((option) => {
          const selected = option.value === memoryMode;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => dispatch(setMemoryMode(option.value))}
              className={`min-w-0 rounded-md px-2 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tertiary/50 ${
                selected
                  ? "bg-white text-tertiary shadow-sm dark:bg-gray-700 dark:text-white"
                  : "text-gray-600 hover:bg-white/70 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700/70 dark:hover:text-white"
              }`}
            >
              <span className="block truncate">
                {t(
                  `user_settings.chat_preferences.memory.options.${option.key}.label`,
                )}
              </span>
            </button>
          );
        })}
      </div>

      <p
        className="text-xs text-gray-500 dark:text-gray-400"
        aria-live="polite"
      >
        {t(
          `user_settings.chat_preferences.memory.options.${selectedMemoryOption.key}.description`,
        )}
      </p>
    </section>
  );
}

export function SuggestionPreference() {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { openModal } = useModal();
  const suggestUserPrompts = useSelector(selectSuggestUserPrompts);
  const setTitleOnce = useSelector(selectSetTitleOnce);

  return (
    <section>
      <div className="flex items-center gap-1.5 px-2">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white">
          {t("user_settings.chat_preferences.suggestions.section_label")}
        </h3>
        <button
          type="button"
          onClick={() => openModal("helpChoiceProposer")}
          aria-label={t(
            "user_settings.chat_preferences.suggestions.help_label",
          )}
          title={t("user_settings.chat_preferences.suggestions.help_label")}
          className="rounded-md p-1 text-tertiary transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tertiary/50 dark:hover:bg-gray-800"
        >
          <HelpCircle className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="flex flex-col gap-3 px-2">
        <ProfilePreferenceSwitch
          label={t("user_settings.chat_preferences.suggestions.label")}
          description={t(
            "user_settings.chat_preferences.suggestions.description",
          )}
          checked={suggestUserPrompts}
          onChange={(checked) => dispatch(setSuggestUserPrompts(checked))}
        />
        <ProfilePreferenceSwitch
          label={t("user_settings.chat_preferences.suggestions.title_once.label")}
          description={t(
            "user_settings.chat_preferences.suggestions.title_once.description",
          )}
          checked={setTitleOnce}
          onChange={(checked) => dispatch(setSetTitleOnce(checked))}
        />
      </div>
    </section>
  );
}

export function HtmlRenderPreference() {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const mode = useSelector(selectHtmlPreview);

  return (
    <section className="flex flex-col gap-3">
      <div className="min-w-0">
        <h3
          id="global-html-preview-label"
          className="text-sm font-medium text-gray-900 dark:text-white"
        >
          {t("user_settings.chat_preferences.html_render.label")}
        </h3>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          {t("user_settings.chat_preferences.html_render.description")}
        </p>
      </div>

      <div
        role="group"
        aria-labelledby="global-html-preview-label"
        className="grid min-h-10 grid-cols-3 gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800/60"
      >
        {HTML_PREVIEW_OPTIONS.map((option) => {
          const selected = option === mode;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => dispatch(setHtmlPreview(option))}
              className={`min-w-0 rounded-md px-2 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tertiary/50 ${
                selected
                  ? "bg-white text-tertiary shadow-sm dark:bg-gray-700 dark:text-white"
                  : "text-gray-600 hover:bg-white/70 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700/70 dark:hover:text-white"
              }`}
            >
              <span className="block truncate">
                {t(
                  `user_settings.chat_preferences.html_render.options.${option}.label`,
                )}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400" aria-live="polite">
        {t(`user_settings.chat_preferences.html_render.options.${mode}.description`)}
      </p>
    </section>
  );
}

export function DocumentConversionPreference() {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const documentConversionMode = useSelector(selectDocumentConversionMode);
  const selectedOption =
    DOCUMENT_CONVERSION_OPTIONS.find(
      (option) => option.value === documentConversionMode,
    ) ?? DOCUMENT_CONVERSION_OPTIONS[2];

  return (
    <section className="flex flex-col gap-2">
      <SegmentedPreference
        label={t("user_settings.chat_preferences.document_conversion.label")}
        description={t(
          `user_settings.chat_preferences.document_conversion.options.${selectedOption.key}.description`,
        )}
        options={DOCUMENT_CONVERSION_OPTIONS.map((option) => ({
          value: option.value,
          label: t(
            `user_settings.chat_preferences.document_conversion.options.${option.key}.label`,
          ),
        }))}
        value={documentConversionMode}
        onChange={(value) => dispatch(setDocumentConversionMode(value))}
      />
    </section>
  );
}

export function RenderingPreferences() {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const renderTypst = useSelector(selectRenderTypst);
  const renderLatex = useSelector(selectRenderLatex);

  return (
    <section className="flex flex-col gap-2">
      <h3 className="px-2 text-sm font-medium text-gray-900 dark:text-white">
        {t("user_settings.chat_preferences.rendering.label")}
      </h3>
      <ProfilePreferenceSwitch
        label={t("user_settings.chat_preferences.typst.label")}
        description={t("user_settings.chat_preferences.typst.description")}
        checked={renderTypst}
        onChange={(checked) => dispatch(setRenderTypst(checked))}
      />
      <ProfilePreferenceSwitch
        label={t("user_settings.chat_preferences.latex.label")}
        description={t("user_settings.chat_preferences.latex.description")}
        checked={renderLatex}
        onChange={(checked) => dispatch(setRenderLatex(checked))}
      />
      <HtmlRenderPreference />
    </section>
  );
}

function SegmentedPreference({ label, description, options, value, onChange }) {
  return (
    <div className="flex min-h-14 w-full items-center justify-between gap-4 rounded-lg px-2 py-2">
      <div className="min-w-0">
        <span className="block text-sm font-medium text-gray-800 dark:text-gray-100">
          {label}
        </span>
        {description && (
          <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
            {description}
          </span>
        )}
      </div>
      <div
        role="group"
        aria-label={label}
        className="flex shrink-0 gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800/60"
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tertiary/50 ${
                selected
                  ? "bg-white text-tertiary shadow-sm dark:bg-gray-700 dark:text-white"
                  : "text-gray-600 hover:bg-white/70 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700/70 dark:hover:text-white"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ScreensaverPreference() {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const disableScreensavers = useSelector(selectDisableScreensavers);

  return (
    <section>
      <h3 className="px-2 text-sm font-medium text-gray-900 dark:text-white">
        {t("user_settings.chat_preferences.screensavers.section_label")}
      </h3>
      <ProfilePreferenceSwitch
        label={t("user_settings.chat_preferences.screensavers.label")}
        description={t(
          "user_settings.chat_preferences.screensavers.description",
        )}
        checked={disableScreensavers}
        onChange={(checked) => dispatch(setDisableScreensavers(checked))}
      />
    </section>
  );
}
