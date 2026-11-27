import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Check } from "lucide-react";

import { getModelsData } from "../../../apis/getModelsData";
import { deletePersona, savePersona } from "../../../db";
import { useToast } from "../../../hooks/useToast";
import { selectUserSettings } from "../../../Redux/reducers/userSettingsReducer";
import { getDefaultSettings } from "../../../utils/conversationUtils";
import TemperatureSlider from "../../SettingsPanel/TemperatureSlider";
import TopPSlider from "../../SettingsPanel/TopPSlider";
import ReasoningEffortContainer from "../../SettingsPanel/ReasoningEffortContainer";

const DEFAULT_SYSTEM_PROMPT = "You are a helpful assistant.";

const inputClass =
  "w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-tertiary/50";

/**
 * Create or edit one of the user's own personas. The settings controls are the
 * ones from the settings panel, driven by a draft `{ settings }` state instead
 * of a conversation.
 */
export default function PersonaEditor({ persona = null, onDone }) {
  const { t } = useTranslation();
  const { notifySuccess, notifyError } = useToast();
  const userSettings = useSelector(selectUserSettings);

  const [title, setTitle] = useState(persona?.title ?? "");
  const [subtitle, setSubtitle] = useState(persona?.subtitle ?? "");
  const [systemPrompt, setSystemPrompt] = useState(
    persona?.system_prompt ?? DEFAULT_SYSTEM_PROMPT,
  );
  const [draft, setDraft] = useState(() => {
    const defaults = getDefaultSettings(userSettings);
    if (!persona) return { settings: { ...defaults, reasoning_effort: null } };
    return {
      settings: {
        ...defaults,
        model: persona.model
          ? { id: persona.model, name: persona["model-name"] || persona.model }
          : defaults.model,
        temperature: persona.temperature ?? defaults.temperature,
        top_p: persona.top_p ?? defaults.top_p,
        reasoning_effort: persona.reasoning_effort ?? null,
      },
    };
  });
  const [models, setModels] = useState(null); // null = loading
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    getModelsData().then((data) => setModels(Array.isArray(data) ? data : []));
  }, []);

  const selectedModel = draft.settings.model;
  // Keep the persona's model visible even when the server no longer lists it.
  const modelOptions =
    models && selectedModel?.id && !models.some((m) => m.id === selectedModel.id)
      ? [selectedModel, ...models]
      : models ?? [];

  const selectModel = (model) => {
    setDraft((prev) => ({
      ...prev,
      // Reasoning options differ per model, so the old index means nothing here.
      settings: { ...prev.settings, model: { id: model.id, name: model.name }, reasoning_effort: null },
    }));
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError(t("persona.errorNameRequired"));
      return;
    }
    if (!systemPrompt.trim()) {
      setError(t("alert.system_prompt_empty"));
      return;
    }
    const { model, temperature, top_p, reasoning_effort } = draft.settings;
    setSaving(true);
    try {
      await savePersona({
        id: persona?.id,
        createdAt: persona?.createdAt,
        title,
        subtitle: subtitle.trim(),
        system_prompt: systemPrompt,
        ...(model?.id ? { model: model.id, "model-name": model.name || model.id } : {}),
        temperature,
        top_p,
        reasoning_effort,
      });
      notifySuccess(t("persona.saved"));
      onDone();
    } catch (err) {
      console.error("Failed to save persona", err);
      notifyError(t("persona.errorSaving"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await deletePersona(persona.id);
    notifySuccess(t("persona.deleted"));
    onDone();
  };

  return (
    <div className="flex flex-col h-[400px] sm:h-[450px] min-h-0">
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 flex flex-col gap-4 text-tertiary">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{t("persona.nameLabel")}</span>
          <input
            autoFocus
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setError("");
            }}
            placeholder={t("persona.namePlaceholder")}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{t("persona.descriptionLabel")}</span>
          <input
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder={t("persona.descriptionPlaceholder")}
            className={inputClass}
          />
        </label>

        <section className="flex flex-col gap-1">
          <span className="text-sm font-medium">{t("persona.modelLabel")}</span>
          {models === null && (
            <p className="text-xs text-gray-500 dark:text-gray-400">{t("persona.modelsLoading")}</p>
          )}
          {models?.length === 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400">{t("persona.modelsUnavailable")}</p>
          )}
          {modelOptions.length > 0 && (
            <div
              role="group"
              aria-label={t("persona.modelLabel")}
              className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700"
            >
              {modelOptions.map((option) => {
                const selected = selectedModel?.id === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => selectModel(option)}
                    className={`flex min-h-9 w-full items-center gap-2 border-b border-gray-100 px-3 py-1.5 text-left text-sm transition-colors last:border-b-0 dark:border-gray-800 cursor-pointer ${
                      selected
                        ? "bg-tertiary/10 text-tertiary dark:bg-tertiary/20 dark:text-blue-300"
                        : "text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800/70"
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate">{option.name}</span>
                    {selected && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <TemperatureSlider localState={draft} setLocalState={setDraft} />
        <TopPSlider localState={draft} setLocalState={setDraft} />
        <ReasoningEffortContainer localState={draft} setLocalState={setDraft} />

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{t("persona.systemPromptLabel")}</span>
          <textarea
            value={systemPrompt}
            onChange={(e) => {
              setSystemPrompt(e.target.value);
              setError("");
            }}
            rows={6}
            className={`${inputClass} resize-y`}
          />
        </label>
      </div>

      <div className="px-4 sm:px-6 py-3 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-wrap items-center gap-2">
        {persona && (
          <button
            type="button"
            onClick={handleDelete}
            className="cursor-pointer px-3 py-1.5 rounded-lg text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
          >
            {confirmDelete ? t("persona.confirmDelete") : t("persona.delete")}
          </button>
        )}
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={onDone}
            className="cursor-pointer px-3 py-1.5 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors text-xs"
          >
            {t("persona.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="cursor-pointer px-3 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white rounded-lg transition-colors text-xs"
          >
            {t("persona.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
