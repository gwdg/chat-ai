import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import {
  Bot,
  Checkmark,
  Folder,
  Locked,
  MagicWand,
  Warning,
} from "@carbon/icons-react";

import BaseModal from "../BaseModal";
import FolderPicker from "../../components/Workspace/FolderPicker";
import { getModelsData } from "../../apis/getModelsData";
import { createWorkspace } from "../../db/workspaceDb";
import { selectUserSettings } from "../../Redux/reducers/userSettingsReducer";
import { getDefaultSettings } from "../../utils/conversationUtils";
import { pickDefaultAgentModel } from "../../agent/models";
import { DEFAULT_WORKSPACE_PERSONA } from "../../agent/prompt";
import { SKILL_EXPLAIN_IMAGE } from "../../agent/tools";
import {
  isRootPath,
  normalizePath,
  slugifyWorkspaceName,
  validateSegment,
} from "../../filesystem/paths";

function defaultRoot(name) {
  return `/${slugifyWorkspaceName(name)}`;
}

function validateRootPath(path) {
  try {
    const normalized = normalizePath(path);
    if (normalized === "/") return "Choose a folder below the root";
    for (const segment of normalized.slice(1).split("/")) {
      const error = validateSegment(segment);
      if (error) return error;
    }
    return null;
  } catch (error) {
    return error?.message || "Invalid path";
  }
}

export default function CreateWorkspaceModal({ isOpen, onClose, modelsData }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const userSettings = useSelector(selectUserSettings);

  const [tab, setTab] = useState("local");
  const [name, setName] = useState("");
  const [rootPath, setRootPath] = useState("");
  const [rootTouched, setRootTouched] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [skills, setSkills] = useState([]);
  const [models, setModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState("");
  const [modelId, setModelId] = useState("");
  const [modelTouched, setModelTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const modelRequestRef = useRef(0);

  useEffect(() => {
    if (!isOpen) return;
    setName("");
    setRootPath("");
    setRootTouched(false);
    setBrowseOpen(false);
    setSkills([]);
    setModelId("");
    setModelTouched(false);
    setError("");
    setNameTouched(false);
    setBusy(false);
    setTab("local");
    setModelsLoading(true);
    setModelsError("");
  }, [isOpen]);

  // Prefer the model list the page has already loaded. This avoids depending on
  // a second /models request that can fail or finish after the user submits.
  useEffect(() => {
    if (!isOpen) return;
    const provided = Array.isArray(modelsData)
      ? modelsData.filter((model) => model?.id)
      : [];
    if (!provided.length) return;
    modelRequestRef.current += 1;
    setModels(provided);
    setModelsLoading(false);
    setModelsError("");
  }, [isOpen, modelsData]);

  const loadModels = async () => {
    const request = modelRequestRef.current + 1;
    modelRequestRef.current = request;
    setModelsLoading(true);
    setModelsError("");
    const data = await getModelsData();
    if (request !== modelRequestRef.current) return;
    if (Array.isArray(data) && data.length) {
      setModels(data);
    } else {
      const status = data instanceof Response ? ` (${data.status})` : "";
      setModelsError(`${t("workspace.models_unavailable")}${status}`);
    }
    setModelsLoading(false);
  };

  useEffect(() => {
    if (!isOpen) return;
    const provided = Array.isArray(modelsData)
      ? modelsData.filter((model) => model?.id)
      : [];
    if (provided.length) return;
    let cancelled = false;
    loadModels().catch(() => {
      if (!cancelled) {
        setModelsError(t("workspace.models_unavailable"));
        setModelsLoading(false);
      }
    });
    return () => {
      cancelled = true;
      modelRequestRef.current += 1;
    };
    // Re-run only when the modal opens or the shared list changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, modelsData]);

  const configuredDefaultModel = useMemo(() => {
    const settings = getDefaultSettings(userSettings);
    const id = settings?.model?.id;
    return id ? { id, name: settings.model.name || id } : null;
  }, [userSettings]);

  const modelOptions = useMemo(() => {
    const availableModels = models.filter((model) => model?.id);
    if (availableModels.length) return availableModels;
    // If `/models` is unreachable, still allow the deployment's configured
    // model instead of creating a workspace with an invented model id.
    return configuredDefaultModel ? [configuredDefaultModel] : [];
  }, [models, configuredDefaultModel]);

  useEffect(() => {
    if (!modelTouched) {
      const preferred = pickDefaultAgentModel(modelOptions);
      if (preferred) setModelId(preferred.id);
    }
  }, [modelOptions, modelTouched]);

  const handleNameChange = (event) => {
    const value = event.target.value;
    setName(value);
    if (!rootTouched) setRootPath(defaultRoot(value));
  };

  const rootError = rootPath
    ? validateRootPath(rootPath)
    : rootTouched || nameTouched
      ? t("workspace.root_not_selectable")
      : null;
  const nameError = nameTouched && !name.trim() ? t("workspace.name_required") : null;
  const selectedModel =
    modelOptions.find((model) => model.id === modelId) ||
    modelOptions[0] ||
    null;

  const handleCreate = async () => {
    setError("");
    setNameTouched(true);
    if (nameError || rootError || !selectedModel) {
      setError(nameError || rootError || t("workspace.model_required"));
      return;
    }
    setBusy(true);
    try {
      const normalizedRoot = normalizePath(rootPath);
      if (isRootPath(normalizedRoot)) throw new Error(t("workspace.root_not_selectable"));
      const settings = {
        ...getDefaultSettings(userSettings),
        model: { id: selectedModel.id, name: selectedModel.name || selectedModel.id },
        system_prompt: DEFAULT_WORKSPACE_PERSONA,
      };
      const id = await createWorkspace({
        name: name.trim(),
        rootPath: normalizedRoot,
        modelId: selectedModel.id,
        modelName: selectedModel.name || selectedModel.id,
        skills,
        settings,
      });
      onClose();
      navigate(`/workspace/${id}`);
    } catch (createError) {
      const message = String(createError?.message || t("workspace.create_error"));
      setError(
        /already exists/i.test(message)
          ? t("workspace.name_taken")
          : message,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey="workspace.create_title"
      maxWidth="max-w-2xl"
      contentClassName="p-5 pt-0 flex max-h-[78vh] flex-col gap-4 overflow-y-auto"
    >
      <p className="text-sm text-base-content/60">{t("workspace.create_intro")}</p>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setTab("local")}
          className={`flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition ${
            tab === "local"
              ? "border-primary bg-primary/10 shadow-sm"
              : "border-base-300 bg-base-100 hover:border-primary/40"
          }`}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Bot size={22} />
          </span>
          <span className="flex w-full items-center justify-between text-sm font-semibold">
            {t("workspace.local_agent")}
            {tab === "local" && <Checkmark size={17} className="text-primary" />}
          </span>
          <span className="text-xs text-base-content/60">{t("workspace.local_agent_desc")}</span>
        </button>

        <button
          type="button"
          disabled
          aria-disabled="true"
          title={t("workspace.remote_coming_soon")}
          className="flex cursor-not-allowed flex-col items-start gap-2 rounded-2xl border border-base-300 bg-base-200/60 p-4 text-left opacity-60"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-base-300 text-base-content/50">
            <Locked size={20} />
          </span>
          <span className="flex w-full items-center justify-between text-sm font-semibold text-base-content/60">
            {t("workspace.remote_agent")}
            <span className="rounded-full bg-base-300 px-2 py-0.5 text-[10px] font-medium">
              {t("workspace.coming_soon")}
            </span>
          </span>
          <span className="text-xs text-base-content/50">{t("workspace.remote_agent_desc")}</span>
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-base-content/80">
            {t("workspace.name")}
          </span>
          <input
            autoFocus
            value={name}
            onChange={handleNameChange}
            onBlur={() => setNameTouched(true)}
            placeholder={t("workspace.name_placeholder")}
            className={`input w-full border-base-300 bg-base-100 ${nameError ? "input-error" : ""}`}
          />
          {nameError && <span className="text-[11px] text-error">{nameError}</span>}
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-base-content/80">
            {t("workspace.root_directory")}
          </span>
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Folder size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
              <input
                value={rootPath}
                onChange={(event) => {
                  setRootPath(event.target.value);
                  setRootTouched(true);
                }}
                onFocus={() => setRootTouched(true)}
                placeholder="/folder-name"
                className={`input w-full border-base-300 bg-base-100 pl-9 font-mono text-xs ${
                  rootError ? "input-error" : ""
                }`}
              />
            </div>
            <button
              type="button"
              className={`btn ${browseOpen ? "btn-active" : ""}`}
              onClick={() => setBrowseOpen((open) => !open)}
            >
              {t("workspace.browse")}
            </button>
          </div>
          <p className="text-[11px] text-base-content/50">{t("workspace.root_hint")}</p>
          {rootError && <span className="text-[11px] text-error">{rootError}</span>}
          {browseOpen && (
            <FolderPicker
              value={rootPath}
              onSelect={(path) => {
                setRootPath(path);
                setRootTouched(true);
                setBrowseOpen(false);
              }}
            />
          )}
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-base-content/80">
            {t("workspace.agent_model")}
          </span>
          <select
            value={selectedModel?.id || ""}
            disabled={modelsLoading || modelOptions.length === 0}
            onChange={(event) => {
              setModelId(event.target.value);
              setModelTouched(true);
            }}
            className="select w-full border-base-300 bg-base-100"
          >
            {modelOptions.length ? (
              modelOptions.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name || model.id}
                </option>
              ))
            ) : (
              <option value="">
                {modelsLoading
                  ? t("workspace.models_loading")
                  : t("workspace.models_unavailable_option")}
              </option>
            )}
          </select>
          {modelsError && (
            <div className="flex items-center gap-2 text-[11px] text-error">
              <Warning size={13} className="shrink-0" />
              <span className="min-w-0 flex-1">{modelsError}</span>
              <button
                type="button"
                className="btn btn-ghost btn-xs shrink-0"
                onClick={() => loadModels()}
              >
                {t("common.retry")}
              </button>
            </div>
          )}
          <p className="text-[11px] text-base-content/50">{t("workspace.model_hint")}</p>
        </label>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-base-content/80">
            {t("workspace.skills")}
          </span>
          <label
            className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition ${
              skills.includes(SKILL_EXPLAIN_IMAGE)
                ? "border-accent bg-accent/10"
                : "border-base-300 bg-base-100 hover:border-accent/40"
            }`}
          >
            <input
              type="checkbox"
              className="checkbox checkbox-accent checkbox-sm"
              checked={skills.includes(SKILL_EXPLAIN_IMAGE)}
              onChange={(event) =>
                setSkills((current) =>
                  event.target.checked
                    ? Array.from(new Set([...current, SKILL_EXPLAIN_IMAGE]))
                    : current.filter((skill) => skill !== SKILL_EXPLAIN_IMAGE),
                )
              }
            />
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <MagicWand size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{t("workspace.skill_explain_image")}</span>
              <span className="block text-[11px] text-base-content/55">
                {t("workspace.skill_explain_image_desc")}
              </span>
            </span>
          </label>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-error/30 bg-error/10 px-3 py-2 text-xs text-error">
          <Warning size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <button type="button" className="btn" onClick={onClose} disabled={busy}>
          {t("common.cancel")}
        </button>
        <button
          type="button"
          className="btn btn-primary gap-2"
          onClick={handleCreate}
          disabled={
            busy ||
            !name.trim() ||
            !rootPath ||
            Boolean(nameError) ||
            Boolean(rootError) ||
            modelsLoading ||
            !selectedModel
          }
        >
          {busy && <span className="loading loading-spinner loading-xs" />}
          {t("workspace.create_workspace")}
        </button>
      </div>
    </BaseModal>
  );
}
