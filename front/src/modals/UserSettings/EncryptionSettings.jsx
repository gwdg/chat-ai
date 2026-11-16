import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import {
  Download,
  KeyRound,
  Link2,
  Lock,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";

import {
  addE2eeKey,
  removeE2eeKey,
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
import { findKeyForAssignment, usableKey } from "../../e2ee/registry";
import { verifyKeyForModel } from "../../e2ee/verify";
import { authHeaders } from "../../apis/authHeaders";
import { resolveBaseURL } from "../../apis/openaiClient";
import { downloadText } from "../../utils/download";
import { useToast } from "../../hooks/useToast";
import E2eeLock from "../../components/Others/E2eeLock";

const MODES = ["paste", "url", "directory"];

const fingerprint = (entry) => usableKey(entry)?.kid ?? "";

export default function EncryptionSettings({ modelsData }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { notifySuccess, notifyError } = useToast();
  const keys = useSelector(selectE2eeKeys);
  const assignments = useSelector(selectE2eeModels);
  const [mode, setMode] = useState("paste");
  const [modelTokens, setModelTokens] = useState("");
  const [keyText, setKeyText] = useState("");
  const [url, setUrl] = useState("");
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

  // Count only bindings that resolve to a usable key: an assigned key that is
  // missing or invalid blocks the model instead of encrypting it.
  const keyedCount = models.filter((model) =>
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
      const result = await fetchKeyDirectory(url);
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
          className="tabs tabs-box tabs-sm grid grid-cols-3"
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
          {/* A directory defines its own key names and model lists. */}
          {mode !== "directory" && (
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
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-base-content/70">
                {t("e2ee.directory_url")}
                <input
                  type="url"
                  className="input input-sm input-bordered w-full"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://example.org/keys/keys.json"
                  spellCheck={false}
                />
              </label>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={handleDirectory}
                disabled={busy || !url.trim()}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                {busy ? t("e2ee.verifying") : t("e2ee.import_directory")}
              </button>
            </div>
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

        {keys.length === 0 ? (
          <p className="text-xs text-base-content/60">{t("e2ee.models_no_keys")}</p>
        ) : models.length === 0 ? (
          <p className="text-xs text-base-content/60">{t("common.loading")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-base-300 rounded-lg border border-base-300">
            {models.map((model) => {
              const assigned = assignments[model.id];
              const entry = findKeyForAssignment(keys, assigned);
              const usable = usableKey(entry);
              return (
                <li
                  key={model.id}
                  className="flex flex-wrap items-center gap-3 px-3 py-2"
                >
                  <span className="flex min-w-0 flex-1 items-center gap-1.5">
                    <span className="truncate text-sm text-base-content">
                      {model.name || model.id}
                    </span>
                    <E2eeLock modelId={model.id} size={13} />
                  </span>
                  {/* Read-only: a key's "Applies to models" list sets the
                      binding, this table only reports the resulting state. */}
                  {usable ? (
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="badge badge-success badge-sm">
                        {t("e2ee.badge")}
                      </span>
                      <span className="max-w-40 truncate text-[0.7rem] text-base-content/60">
                        {entry.name || entry.id}
                      </span>
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
