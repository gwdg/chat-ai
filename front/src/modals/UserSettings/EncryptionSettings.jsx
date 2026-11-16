import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import {
  Download,
  FolderDown,
  KeyRound,
  Link2,
  Lock,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Upload,
} from "lucide-react";

import {
  addE2eeKey,
  removeE2eeKey,
  selectConversationSummaries,
  selectDefaultModel,
  selectE2eeKeys,
  selectE2eeModels,
  setE2eeModelKey,
} from "../../Redux/reducers/userSettingsReducer";
import {
  keyEntryFromText,
  fetchKeyDirectory,
  fetchKeyFromUrl,
  mergeKeyImport,
  publicKeyFileText,
} from "../../e2ee/keys";
import {
  modelKeyName,
  parseModelTokens,
  resolveModelTokens,
} from "../../e2ee/modelBindings";
import { internalModelUsage } from "../../e2ee/modelUsage";
import {
  DEFAULT_KEY_BASE_URL,
  fetchPublishedKeyTexts,
} from "../../e2ee/publishedKeys";
import { findKeyForAssignment, usableKey } from "../../e2ee/registry";
import { verifyKeyForModel } from "../../e2ee/verify";
import { authHeaders } from "../../apis/authHeaders";
import { resolveBaseURL } from "../../apis/openaiClient";
import { downloadText } from "../../utils/download";
import { useToast } from "../../hooks/useToast";
import E2eeLock from "../../components/Others/E2eeLock";

const MODES = ["published", "paste", "url", "directory"];

const fingerprint = (entry) => usableKey(entry)?.kid ?? "";

/** The key directory the deployment publishes its `.pub` files under. */
const configuredKeyUrl = () => {
  const configured = import.meta.env.VITE_E2EE_KEY_URL;
  return String(configured || "").trim() || DEFAULT_KEY_BASE_URL;
};

/** `<e2eeKeyUrl>keys.json`: the manifest `make -C encryption keys` writes. */
const configuredKeyDirectoryUrl = () => {
  const base = configuredKeyUrl();
  return `${base.endsWith("/") ? base : `${base}/`}keys.json`;
};

export default function EncryptionSettings({ modelsData }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { notifySuccess, notifyError } = useToast();
  const keys = useSelector(selectE2eeKeys);
  const assignments = useSelector(selectE2eeModels);
  const [mode, setMode] = useState("published");
  const [modelTokens, setModelTokens] = useState("");
  const [keyText, setKeyText] = useState("");
  const [url, setUrl] = useState("");
  const [directoryUrl, setDirectoryUrl] = useState(configuredKeyDirectoryUrl);
  const [publishedUrl, setPublishedUrl] = useState(configuredKeyUrl);
  const [publishProgress, setPublishProgress] = useState(null);
  const [publishResult, setPublishResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);
  const fileRef = useRef(null);

  const models = useMemo(
    () =>
      [...(modelsData ?? [])].sort((a, b) =>
        String(a?.name || a?.id).localeCompare(String(b?.name || b?.id)),
      ),
    [modelsData],
  );

  // Internal features (titles, memory, proposals, image analysis) send a
  // request without the user picking that model in a chat, so their models are
  // listed even while unencrypted. Everything else only appears once a key is
  // bound to it.
  const defaultModel = useSelector(selectDefaultModel);
  const summariesEnabled = useSelector(selectConversationSummaries);
  const usage = useMemo(
    () =>
      internalModelUsage(import.meta.env, {
        defaultModelId: defaultModel?.id ?? "",
        summaries: summariesEnabled,
      }),
    [defaultModel, summariesEnabled],
  );
  const visibleModels = models.filter(
    (model) => assignments[model.id] || usage.has(model.id),
  );

  // Count only bindings that resolve to a usable key: an assigned key that is
  // missing or invalid blocks the model instead of encrypting it.
  const keyedCount = visibleModels.filter((model) =>
    usableKey(findKeyForAssignment(keys, assignments[model.id])),
  ).length;

  // Parsing a key only proves it is 32 bytes wide. It does not prove that it is
  // the key of the node serving a model. Before a key is stored, every model it
  // is bound to gets one real sealed request, and a rejection keeps the key out
  // instead of leaving a model that would fail on the first prompt.
  const verifyPairs = async (pairs) => {
    if (!pairs.length) return 0;
    const url = `${resolveBaseURL().replace(/\/+$/, "")}/chat/completions`;
    const headers = authHeaders();
    for (const { key, model } of pairs) {
      try {
        await verifyKeyForModel({ modelId: model.id, key, url, headers });
      } catch (caught) {
        throw new Error(
          t("e2ee.verify_failed", {
            model: model.name || model.id,
            reason: caught?.message || t("e2ee.import_error"),
          }),
        );
      }
    }
    return pairs.length;
  };

  // Adds the key and binds it to the models typed in the field. Unknown tokens
  // do not abort the import once something matched: the key and the known
  // bindings are still saved and a toast names the entries that matched
  // nothing. Tokens that match nothing at all are an error, because there is
  // then nothing left to verify the key against.
  const addKey = async (entry) => {
    const tokens = parseModelTokens(modelTokens);
    const { matched, unknown } = resolveModelTokens(models, tokens);
    if (tokens.length > 0 && matched.length === 0) {
      throw new Error(
        t("e2ee.no_models_matched", { models: tokens.join(", ") }),
      );
    }

    await verifyPairs(matched.map((model) => ({ key: entry, model })));

    const named = {
      ...entry,
      name:
        entry.name ||
        modelKeyName(matched) ||
        t("e2ee.fallback_name", {
          fingerprint: String(entry.kid || entry.id).slice(0, 8),
        }),
    };
    dispatch(addE2eeKey(named));
    for (const model of matched) {
      dispatch(setE2eeModelKey({ modelId: model.id, keyId: named.id }));
    }
    if (unknown.length > 0) {
      notifyError(
        t("e2ee.unknown_models", { models: unknown.join(", ") }),
        4000,
      );
    } else if (matched.length > 0) {
      notifySuccess(t("e2ee.verified_added", { count: matched.length }));
    } else {
      notifySuccess(t("e2ee.added_unverified"));
    }
  };

  const resetForm = () => {
    setModelTokens("");
    setKeyText("");
    setUrl("");
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const run = async (task) => {
    setBusy(true);
    setError("");
    try {
      await task();
      resetForm();
    } catch (caught) {
      setError(caught?.message || t("e2ee.import_error"));
    } finally {
      setBusy(false);
    }
  };

  const handlePaste = () =>
    run(async () => {
      const entry = keyEntryFromText(keyText, { source: "paste" });
      await addKey(entry);
    });

  const handleFile = (event) =>
    run(async () => {
      const file = event.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      const entry = keyEntryFromText(text, { source: "file" });
      await addKey(entry);
    });

  const handleUrl = () =>
    run(async () => {
      const entry = await fetchKeyFromUrl(url);
      await addKey(entry);
    });

  const handleDirectory = () =>
    run(async () => {
      const result = await fetchKeyDirectory(directoryUrl);
      const merged = mergeKeyImport(keys, result.keys);
      // A directory carries its own model lists; verify every incoming key
      // against the models that exist here before storing any of them.
      const known = new Map(models.map((model) => [model.id, model]));
      const pairs = Object.entries(result.models ?? {})
        .map(([modelId, keyId]) => ({
          key: result.keys.find((entry) => entry.id === keyId),
          model: known.get(modelId),
        }))
        .filter((pair) => pair.key && pair.model);
      await verifyPairs(pairs);

      for (const key of result.keys) dispatch(addE2eeKey(key));
      for (const [modelId, keyId] of Object.entries(result.models)) {
        if (merged.some((key) => key.id === keyId)) {
          dispatch(setE2eeModelKey({ modelId, keyId }));
        }
      }
      notifySuccess(t("e2ee.directory_imported", { count: result.keys.length }));
      resetForm();
    });

  // The one-click path for a deployment that publishes its own node keys: one
  // `<MODELNAME>.pub` per model under the configured URL. A 404 means the model
  // has no E2EE node, which is normal and reported separately. A downloaded key
  // is still tested against its own model before it is stored, so a wrong or
  // stale file cannot silently break the "keyed means encrypted" guarantee, and
  // one failing model does not block the rest.
  const handlePublished = () =>
    run(async () => {
      const base = publishedUrl.trim();
      if (!base) throw new Error(t("e2ee.published_url_required"));
      const candidates = models.filter(
        (model) => !usableKey(findKeyForAssignment(keys, assignments[model.id])),
      );
      if (!candidates.length) {
        setPublishResult({ imported: 0, missing: 0, failed: [] });
        notifySuccess(t("e2ee.published_none_needed"));
        return;
      }

      setPublishResult(null);
      setPublishProgress({ phase: "fetch", done: 0, total: candidates.length });
      try {
        const downloaded = await fetchPublishedKeyTexts({
          baseUrl: base,
          models: candidates,
          onProgress: ({ done, total }) =>
            setPublishProgress({ phase: "fetch", done, total }),
        });

        const unreadable = [];
        const parsed = [];
        for (const { model, url: keyUrl, text } of downloaded.found) {
          try {
            parsed.push({
              model,
              key: keyEntryFromText(text, {
                name: model.name || model.id,
                url: keyUrl,
                source: "published",
              }),
            });
          } catch (caught) {
            unreadable.push({
              model,
              reason: caught?.message || t("e2ee.import_error"),
            });
          }
        }

        const verifyUrl = `${resolveBaseURL().replace(/\/+$/, "")}/chat/completions`;
        const headers = authHeaders();
        const verified = [];
        const rejected = [];
        for (let index = 0; index < parsed.length; index += 1) {
          setPublishProgress({
            phase: "verify",
            done: index,
            total: parsed.length,
          });
          const { model, key } = parsed[index];
          try {
            await verifyKeyForModel({
              modelId: model.id,
              key,
              url: verifyUrl,
              headers,
            });
            verified.push({ model, key });
          } catch (caught) {
            rejected.push({
              model,
              reason: caught?.message || t("e2ee.import_error"),
            });
          }
        }

        for (const { model, key } of verified) {
          dispatch(addE2eeKey(key));
          dispatch(setE2eeModelKey({ modelId: model.id, keyId: key.id }));
        }
        setPublishResult({
          imported: verified.length,
          missing: downloaded.missing.length,
          failed: [...downloaded.failed, ...unreadable, ...rejected],
        });
        if (verified.length) {
          notifySuccess(
            t("e2ee.published_imported", { count: verified.length }),
          );
        } else {
          notifyError(t("e2ee.published_none"));
        }
      } finally {
        setPublishProgress(null);
      }
    });

  const handleDownload = (entry) => {
    const safe = (entry.name || entry.id).replace(/[^\w.-]+/g, "-");
    downloadText(
      publicKeyFileText(entry),
      "text/plain;charset=utf-8",
      `${safe}.pub`,
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="text-xs leading-relaxed text-base-content/70">
        {t("e2ee.description")}
      </p>

      <section className="flex flex-col gap-3" data-guide="e2ee-keys">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-accent" aria-hidden="true" />
          <h3 className="text-sm font-medium text-base-content">
            {t("e2ee.keys_title")}
          </h3>
        </div>

        {keys.length === 0 ? (
          <p className="text-xs text-base-content/60">{t("e2ee.no_keys")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-base-300 rounded-lg border border-base-300">
            {keys.map((entry) => {
              const usable = usableKey(entry);
              return (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center gap-3 px-3 py-2.5"
                >
                  <ShieldCheck
                    className={`h-4 w-4 shrink-0 ${usable ? "text-success" : "text-error"}`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-base-content">
                      {entry.name || entry.id}
                    </p>
                    <p className="truncate font-mono text-[0.7rem] text-base-content/60">
                      {usable
                        ? `${entry.kid || fingerprint(entry)} · ${entry.publicKey}`
                        : t("e2ee.invalid_key")}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs btn-square"
                    onClick={() => handleDownload(entry)}
                    title={t("e2ee.download")}
                    aria-label={t("e2ee.download")}
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs btn-square text-error"
                    onClick={() =>
                      setPendingDelete(
                        pendingDelete === entry.id ? null : entry.id,
                      )
                    }
                    title={t("e2ee.remove")}
                    aria-label={t("e2ee.remove")}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                  {pendingDelete === entry.id && (
                    <div className="flex w-full items-center justify-end gap-2 pt-1">
                      <span className="text-xs text-base-content/70">
                        {t("e2ee.remove_confirm")}
                      </span>
                      <button
                        type="button"
                        className="btn btn-error btn-xs"
                        onClick={() => {
                          dispatch(removeE2eeKey(entry.id));
                          setPendingDelete(null);
                          notifySuccess(t("e2ee.removed"));
                        }}
                      >
                        {t("e2ee.remove")}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        onClick={() => setPendingDelete(null)}
                      >
                        {t("common.cancel")}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div
          role="group"
          aria-label={t("e2ee.import_method")}
          className="tabs tabs-box tabs-sm grid grid-cols-2 sm:grid-cols-4"
        >
          {MODES.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => {
                setMode(value);
                setError("");
              }}
              className={`tab min-w-0 text-xs font-medium ${mode === value ? "tab-active text-accent!" : ""}`}
            >
              <span className="block truncate">
                {t(`e2ee.modes.${value}`)}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          {/* A directory and the published-key loader define their own model
              bindings; the manual field only belongs to the other modes. */}
          {mode !== "directory" && mode !== "published" && (
            <label className="flex flex-col gap-1 text-xs text-base-content/70">
              {t("e2ee.models_field")}
              <input
                type="text"
                className="input input-sm input-bordered w-full"
                value={modelTokens}
                onChange={(event) => setModelTokens(event.target.value)}
                placeholder={t("e2ee.models_field_placeholder")}
                spellCheck={false}
              />
              <span className="text-[0.7rem] text-base-content/60">
                {t("e2ee.models_field_hint")}
              </span>
            </label>
          )}

          {mode === "published" && (
            <div className="flex flex-col gap-2" data-guide="e2ee-published">
              <p className="flex gap-2 text-xs leading-relaxed text-base-content/70">
                <TriangleAlert
                  className="mt-0.5 h-4 w-4 shrink-0 text-warning"
                  aria-hidden="true"
                />
                {t("e2ee.published_hint")}
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-base-content/70">
                  {t("e2ee.published_url")}
                  <input
                    type="url"
                    className="input input-sm input-bordered w-full"
                    value={publishedUrl}
                    onChange={(event) => setPublishedUrl(event.target.value)}
                    placeholder={DEFAULT_KEY_BASE_URL}
                    spellCheck={false}
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={handlePublished}
                  disabled={busy || !publishedUrl.trim()}
                >
                  <FolderDown className="h-4 w-4" aria-hidden="true" />
                  {busy ? t("e2ee.published_loading") : t("e2ee.published_load")}
                </button>
              </div>

              {publishProgress && (
                <div
                  className="flex flex-col gap-1"
                  role="status"
                  aria-live="polite"
                >
                  <progress
                    className="progress progress-info w-full"
                    value={publishProgress.done}
                    max={Math.max(publishProgress.total, 1)}
                  />
                  <span className="text-[0.7rem] text-base-content/60">
                    {t(
                      publishProgress.phase === "verify"
                        ? "e2ee.published_progress_verify"
                        : "e2ee.published_progress_fetch",
                      {
                        done: publishProgress.done,
                        total: publishProgress.total,
                      },
                    )}
                  </span>
                </div>
              )}

              {publishResult && (
                <div
                  className="flex flex-col gap-1 rounded-md border border-base-300 p-2 text-xs"
                  role="status"
                >
                  <span className="text-base-content/70">
                    {t("e2ee.published_summary", {
                      imported: publishResult.imported,
                      missing: publishResult.missing,
                      failed: publishResult.failed.length,
                    })}
                  </span>
                  {publishResult.failed.length > 0 && (
                    <>
                      <span className="text-warning">
                        {t("e2ee.published_failed_title")}
                      </span>
                      <ul className="flex flex-col gap-0.5 text-base-content/60">
                        {publishResult.failed
                          .slice(0, 6)
                          .map(({ model, reason }) => (
                            <li key={model.id} className="truncate">
                              <span className="text-base-content/80">
                                {model.name || model.id}
                              </span>
                              {reason ? ` — ${reason}` : ""}
                            </li>
                          ))}
                        {publishResult.failed.length > 6 && (
                          <li>
                            {t("e2ee.published_more", {
                              count: publishResult.failed.length - 6,
                            })}
                          </li>
                        )}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {mode === "paste" && (
            <>
              <label className="flex flex-col gap-1 text-xs text-base-content/70">
                {t("e2ee.public_key")}
                <textarea
                  className="textarea textarea-bordered min-h-20 w-full font-mono text-xs"
                  value={keyText}
                  onChange={(event) => setKeyText(event.target.value)}
                  placeholder={t("e2ee.public_key_placeholder")}
                  spellCheck={false}
                />
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={handlePaste}
                  disabled={busy || !keyText.trim()}
                >
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  {busy ? t("e2ee.verifying") : t("e2ee.add_key")}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                >
                  {t("e2ee.choose_file")}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pub,.txt,text/plain"
                  className="hidden"
                  onChange={handleFile}
                />
              </div>
            </>
          )}

          {mode === "url" && (
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-base-content/70">
                {t("e2ee.key_url")}
                <input
                  type="url"
                  className="input input-sm input-bordered w-full"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://example.org/keys/qwen.pub"
                  spellCheck={false}
                />
              </label>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={handleUrl}
                disabled={busy || !url.trim()}
              >
                <Link2 className="h-4 w-4" aria-hidden="true" />
                {busy ? t("e2ee.verifying") : t("e2ee.fetch_key")}
              </button>
            </div>
          )}

          {mode === "directory" && (
            <>
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-base-content/70">
                  {t("e2ee.directory_url")}
                  <input
                    type="url"
                    className="input input-sm input-bordered w-full"
                    value={directoryUrl}
                    onChange={(event) => setDirectoryUrl(event.target.value)}
                    placeholder="https://example.org/keys/keys.json"
                    spellCheck={false}
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={handleDirectory}
                  disabled={busy || !directoryUrl.trim()}
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  {busy ? t("e2ee.verifying") : t("e2ee.import_directory")}
                </button>
              </div>
              <p className="text-xs text-base-content/60">
                {t("e2ee.directory_hint")}
              </p>
            </>
          )}

          {error && (
            <p className="text-xs text-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3" data-guide="e2ee-models">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-accent" aria-hidden="true" />
            <h3 className="text-sm font-medium text-base-content">
              {t("e2ee.models_title")}
            </h3>
          </div>
          <span className="text-xs text-base-content/60">
            {t("e2ee.models_keyed", { count: keyedCount })}
          </span>
        </div>
        <p className="text-xs leading-relaxed text-base-content/70">
          {t("e2ee.models_description")}
        </p>
        <p className="text-xs text-base-content/60">
          {t("e2ee.models_filtered_hint")}
        </p>

        {models.length === 0 ? (
          <p className="text-xs text-base-content/60">{t("common.loading")}</p>
        ) : visibleModels.length === 0 ? (
          <p className="text-xs text-base-content/60">{t("e2ee.models_empty")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-base-300 rounded-lg border border-base-300">
            {visibleModels.map((model) => {
              const assigned = assignments[model.id];
              const entry = findKeyForAssignment(keys, assigned);
              const usable = usableKey(entry);
              const features = usage.get(model.id) ?? [];
              // A key imported without an explicit name is labelled with the
              // model names it applies to, so repeating that label here would
              // just print the row title a second time.
              const modelLabel = String(model.name || model.id)
                .trim()
                .toLowerCase();
              const keyLabel = usable
                ? String(entry.name || entry.id || "").trim()
                : "";
              const keyIsModelLabel = keyLabel
                .split(",")
                .map((part) => part.trim().toLowerCase())
                .some(
                  (part) =>
                    part === modelLabel ||
                    part === String(model.id).trim().toLowerCase(),
                );
              return (
                <li
                  key={model.id}
                  className="flex flex-wrap items-center gap-3 px-3 py-2"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-sm text-base-content">
                        {model.name || model.id}
                      </span>
                      <E2eeLock modelId={model.id} size={13} />
                    </span>
                    {features.length > 0 && (
                      <span className="flex flex-wrap items-center gap-1">
                        <span className="text-[0.7rem] text-base-content/50">
                          {t("e2ee.used_for")}
                        </span>
                        {features.map((feature) => (
                          <span
                            key={feature}
                            className="badge badge-ghost badge-xs"
                          >
                            {t(`e2ee.features.${feature}`)}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                  {/* Read-only: a key's "Applies to models" list sets the
                      binding, this table only reports the resulting state. */}
                  {usable ? (
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="badge badge-success badge-sm"
                        title={
                          keyLabel
                            ? t("e2ee.encrypted_with", { key: keyLabel })
                            : undefined
                        }
                      >
                        {t("e2ee.badge")}
                      </span>
                      {keyLabel && !keyIsModelLabel && (
                        <span className="max-w-40 truncate text-[0.7rem] text-base-content/60">
                          {keyLabel}
                        </span>
                      )}
                    </span>
                  ) : assigned ? (
                    <span
                      className="badge badge-error badge-sm"
                      title={t("e2ee.invalid_key")}
                    >
                      {t("e2ee.models_blocked")}
                    </span>
                  ) : (
                    <span className="badge badge-ghost badge-sm">
                      {t("e2ee.not_encrypted")}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
