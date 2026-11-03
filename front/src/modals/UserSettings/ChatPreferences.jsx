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
  selectHtmlRenderMode,
  setHtmlRenderMode,
  selectHtmlLoadExternal,
  setHtmlLoadExternal,
  selectHtmlSanitization,
  setHtmlSanitization,
  selectDocumentConversionMode,
  setDocumentConversionMode,
  selectConversationSummaries,
  setConversationSummaries,
  setSendWithEnter,
} from "../../Redux/reducers/userSettingsReducer";
import { useModal } from "../ModalContext";
import { useSendWithEnter } from "../../hooks/useSendWithEnter";
import ProfilePreferenceSwitch from "./ProfilePreferenceSwitch";

const MEMORY_OPTIONS = [
  { value: 0, key: "none" },
  { value: 1, key: "recall" },
  { value: 2, key: "learn" },
];

const HTML_RENDER_OPTIONS = [
  { value: "render", key: "render" },
  { value: "code", key: "code" },
  { value: "off", key: "off" },
];

const HTML_SANITIZATION_OPTIONS = [
  { value: "strict", key: "strict" },
  { value: "relaxed", key: "relaxed" },
];

const DOCUMENT_CONVERSION_OPTIONS = [
  { value: "server", key: "server" },
  { value: "browser", key: "browser" },
  { value: "choice", key: "choice" },
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
            className="text-sm font-medium text-base-content"
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
            className="btn btn-ghost btn-xs btn-square text-accent"
          >
            <HelpCircle className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-0.5 text-xs text-base-content/70">
          {t("user_settings.chat_preferences.memory.description")}
        </p>
      </div>

      <div
        role="group"
        aria-labelledby="global-memory-mode-label"
        className="tabs tabs-box tabs-sm grid grid-cols-3"
      >
        {MEMORY_OPTIONS.map((option) => {
          const selected = option.value === memoryMode;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => dispatch(setMemoryMode(option.value))}
              className={`tab min-w-0 text-xs font-medium ${selected ? "tab-active text-accent!" : ""}`}
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
        className="text-xs text-base-content/70"
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
        <h3 className="text-sm font-medium text-base-content">
          {t("user_settings.chat_preferences.suggestions.section_label")}
        </h3>
        <button
          type="button"
          onClick={() => openModal("helpChoiceProposer")}
          aria-label={t(
            "user_settings.chat_preferences.suggestions.help_label",
          )}
          title={t("user_settings.chat_preferences.suggestions.help_label")}
          className="btn btn-ghost btn-xs btn-square text-accent"
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

export function SubmissionPreference() {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const sendWithEnter = useSendWithEnter();

  const options = [
    {
      value: true,
      label: t("user_settings.chat_preferences.submission.options.enter.label"),
      description: t(
        "user_settings.chat_preferences.submission.options.enter.description",
      ),
    },
    {
      value: false,
      label: t(
        "user_settings.chat_preferences.submission.options.shift_enter.label",
      ),
      description: t(
        "user_settings.chat_preferences.submission.options.shift_enter.description",
      ),
    },
  ];
  const selectedOption =
    options.find((option) => option.value === sendWithEnter) ?? options[0];

  return (
    <section className="flex flex-col gap-2">
      <SegmentedPreference
        label={t("user_settings.chat_preferences.submission.label")}
        description={selectedOption.description}
        options={options}
        value={sendWithEnter}
        onChange={(value) => dispatch(setSendWithEnter(value))}
      />
    </section>
  );
}

export function ConversationSummaryPreference() {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const conversationSummaries = useSelector(selectConversationSummaries);

  return (
    <section className="flex flex-col gap-2">
      <h3 className="px-2 text-sm font-medium text-base-content">
        {t("user_settings.chat_preferences.summaries.section_label")}
      </h3>
      <ProfilePreferenceSwitch
        label={t("user_settings.chat_preferences.summaries.label")}
        description={t(
          "user_settings.chat_preferences.summaries.description",
        )}
        checked={conversationSummaries}
        onChange={(checked) => dispatch(setConversationSummaries(checked))}
      />
    </section>
  );
}

export function HtmlRenderPreference() {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const htmlRenderMode = useSelector(selectHtmlRenderMode);
  const htmlLoadExternal = useSelector(selectHtmlLoadExternal);
  const htmlSanitization = useSelector(selectHtmlSanitization);
  const selectedOption =
    HTML_RENDER_OPTIONS.find((option) => option.value === htmlRenderMode) ??
    HTML_RENDER_OPTIONS[0];
  const selectedSanitizationOption =
    HTML_SANITIZATION_OPTIONS.find(
      (option) => option.value === htmlSanitization,
    ) ?? HTML_SANITIZATION_OPTIONS[0];

  return (
    <section className="flex flex-col gap-2">
      <SegmentedPreference
        label={t("user_settings.chat_preferences.html_render.label")}
        description={t(
          `user_settings.chat_preferences.html_render.options.${selectedOption.key}.description`,
        )}
        options={HTML_RENDER_OPTIONS.map((option) => ({
          value: option.value,
          label: t(
            `user_settings.chat_preferences.html_render.options.${option.key}.label`,
          ),
        }))}
        value={htmlRenderMode}
        onChange={(value) => dispatch(setHtmlRenderMode(value))}
      />

      <div className="ml-4 flex flex-col gap-2">
        <ProfilePreferenceSwitch
          label={t(
            "user_settings.chat_preferences.html_render.external_references.label",
          )}
          description={t(
            "user_settings.chat_preferences.html_render.external_references.description",
          )}
          checked={htmlLoadExternal}
          onChange={(checked) => dispatch(setHtmlLoadExternal(checked))}
        />

        <SegmentedPreference
          label={t(
            "user_settings.chat_preferences.html_render.sanitization.label",
          )}
          description={t(
            `user_settings.chat_preferences.html_render.sanitization.options.${selectedSanitizationOption.key}.description`,
          )}
          options={HTML_SANITIZATION_OPTIONS.map((option) => ({
            value: option.value,
            label: t(
              `user_settings.chat_preferences.html_render.sanitization.options.${option.key}.label`,
            ),
          }))}
          value={htmlSanitization}
          onChange={(value) => dispatch(setHtmlSanitization(value))}
        />
      </div>
    </section>
  );
}

function SegmentedPreference({ label, description, options, value, onChange }) {
  return (
    <div className="flex min-h-14 w-full items-center justify-between gap-4 rounded-lg px-2 py-2">
      <div className="min-w-0">
        <span className="block text-sm font-medium text-base-content">
          {label}
        </span>
        {description && (
          <span className="mt-0.5 block text-xs text-base-content/70">
            {description}
          </span>
        )}
      </div>
      <div
        role="group"
        aria-label={label}
        className="tabs tabs-box tabs-xs shrink-0"
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={`tab text-xs font-medium ${selected ? "tab-active text-accent!" : ""}`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
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
      <h3 className="px-2 text-sm font-medium text-base-content">
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
