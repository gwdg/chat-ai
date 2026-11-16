import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import {
  Download,
  FlaskConical,
  FolderDown,
  FolderOpen,
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
  clearE2eeKeys,
  removeE2eeKey,
  selectConversationSummaries,
  selectDefaultModel,
  selectE2eeKeys,
  selectE2eeModels,
  setE2eeModelKey,
  updateE2eeKey,
} from "../../Redux/reducers/userSettingsReducer";
import {
  keyEntryFromText,
  fetchKeyDirectory,
  fetchKeyFromUrl,
  publicKeyFileText,
  readKeyFolder,
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
  publishedKeyFileName,
} from "../../e2ee/publishedKeys";
import { findKeyForAssignment, usableKey } from "../../e2ee/registry";
import { verifyKeyForModel } from "../../e2ee/verify";
import { authHeaders } from "../../apis/authHeaders";
import { resolveBaseURL } from "../../apis/openaiClient";
import { downloadText } from "../../utils/download";
import { useToast } from "../../hooks/useToast";

const MODES = ["published", "paste", "url", "directory"];

// The key list colours follow the last sealed test, not the key text: a key
// that parses can still be the wrong key for the node that serves the model.
const KEY_STATE_ICON = {
  working: "text-success",
  failed: "text-error",
  invalid: "text-error",
  untested: "text-warning",
};
const KEY_STATE_BADGE = {
  working: "badge-success",
  failed: "badge-error",
  untested: "badge-ghost",
};

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
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  // `null`, a key id, or "all": one test runs at a time, because each one is a
  // real request to a model.
  const [testing, setTesting] = useState(null);
  const fileRef = useRef(null);

  const models = useMemo(
    () =>
      [...(modelsData ?? [])].sort((a, b) =>
        String(a?.name || a?.id).localeCompare(String(b?.name || b?.id)),
      ),
    [modelsData],
  );

  // Internal features (titles, memory, proposals, summaries, image analysis)
  // send a request without the user picking that model in a chat, which is why
  // their models are the ones worth reporting here.
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

  // The table answers one question: which models this deployment runs without
  // the extra layer even though a feature uses them in the background (titles,
  // memory, proposals, summaries, image analysis). A model with a working key
  // is already protected and therefore not listed.
  //
  // A feature model that the deployment's model list does not contain is kept
  // as a row of its own. Without that, a feature simply disappears from this
  // table when its id is wrong (a bridge-prefixed copy, a typo in
  // `explainImageModel`) or when the app is pointed at an endpoint that serves
  // a different set, and nothing would tell the user that those requests are
  // unprotected.
  const functionModels = useMemo(() => {
    const encrypted = (modelId) =>
      usableKey(findKeyForAssignment(keys, assignments[modelId]));
    const listed = models
      .filter((model) => usage.has(model.id) && !encrypted(model.id))
      .map((model) => ({
        id: model.id,
        name: model.name || model.id,
        features: usage.get(model.id) ?? [],
        missing: false,
      }));
    const absent = [...usage.keys()]
      .filter(
        (modelId) =>
          !encrypted(modelId) &&
          !models.some((model) => model.id === modelId),
      )
      .sort()
      .map((modelId) => ({
        id: modelId,
        name: modelId,
        features: usage.get(modelId) ?? [],
        missing: true,
      }));
    return [...listed, ...absent];
  }, [models, usage, keys, assignments]);

  // Count every model whose binding resolves to a usable key. A binding can
  // outlive a model list (an imported conversation, a different deployment),
  // and its model is encrypted even when it is not listed here.
  const keyedCount = Object.keys(assignments).filter((modelId) =>
    usableKey(findKeyForAssignment(keys, assignments[modelId])),
  ).length;

  // Parsing a key only proves it is 32 bytes wide. It does not prove that it is
  // the key of the node serving a model. Every (key, model) pair therefore gets
  // one real sealed request, and the result is per model: a key that works for
  // one model is still stored, while the models whose test fails stay
  // unencrypted and are reported instead of being bound to a dead key. Without
  // this, a single bad model would make the whole import look valid and the
  // first prompt would fail.
  const verifyPairs = async (pairs) => {
    const verified = [];
    const rejected = [];
    if (!pairs.length) return { verified, rejected };
    const url = `${resolveBaseURL().replace(/\/+$/, "")}/chat/completions`;
    const headers = authHeaders();
    for (const { key, model } of pairs) {
      try {
        await verifyKeyForModel({ modelId: model.id, key, url, headers });
        verified.push({ key, model });
      } catch (caught) {
        rejected.push({
          model,
          key,
          reason: caught?.message || t("e2ee.import_error"),
        });
      }
    }
    return { verified, rejected };
  };

  // The record a successful or failed test leaves on the key. `testedAt` alone
  // means the test ran; an empty `testedModels` means it passed nowhere.
  const testRecord = (passedModels) => ({
    testedAt: new Date().toISOString(),
    testedModels: passedModels.map((model) => model.id),
  });

  // A key is expected to encrypt exactly the models it is bound to. A binding
  // can name a model this deployment no longer lists, and that id is still what
  // the test request has to carry, so the display name is optional.
  const boundModelsFor = (entry) =>
    Object.entries(assignments)
      .filter(([, keyId]) => findKeyForAssignment([entry], keyId))
      .map(
        ([modelId]) =>
          models.find((model) => model.id === modelId) ?? {
            id: modelId,
            name: modelId,
          },
      );

  // Import tests every pair once; this is the only way to check a stored key
  // afterwards, when the model moved to another node, the key came back from a
  // backup, or another tab (or the Meta chat) created the binding.
  const testKey = async (entry) => {
    const bound = boundModelsFor(entry);
    if (!bound.length) return null;
    const { verified, rejected } = await verifyPairs(
      bound.map((model) => ({ key: entry, model })),
    );
    dispatch(updateE2eeKey({ id: entry.id, patch: testRecord(verified.map(({ model }) => model)) }));
    return { verified, rejected };
  };

  const handleTest = async (entry) => {
    setTesting(entry.id);
    try {
      const result = await testKey(entry);
      if (!result) return;
      const { verified, rejected } = result;
      const passed = t("e2ee.test_ok", { count: verified.length });
      if (rejected.length > 0) {
        // One toast at a time: a partial pass is reported as one warning.
        notifyError(
          `${verified.length ? `${passed} ` : ""}${t("e2ee.test_failed", {
            models: rejected
              .map(({ model }) => model.name || model.id)
              .join(", "),
            reason: rejected[0].reason,
          })}`,
          8000,
        );
      } else {
        notifySuccess(passed);
      }
    } finally {
      setTesting(null);
    }
  };

  const handleTestAll = async () => {
    setTesting("all");
    let tested = 0;
    let working = 0;
    const failing = [];
    try {
      for (const entry of keys) {
        const label = entry.name || entry.id;
        if (!usableKey(entry)) {
          failing.push(label);
          continue;
        }
        const result = await testKey(entry);
        // A key without a binding has nothing to test and stays unmarked.
        if (!result) continue;
        tested += 1;
        if (result.verified.length && !result.rejected.length) working += 1;
        else failing.push(label);
      }
    } finally {
      setTesting(null);
    }

    if (!tested && !failing.length) {
      notifyError(t("e2ee.test_no_bindings"));
      return;
    }
    const summary = t("e2ee.test_all_done", { working, tested });
    if (failing.length) {
      notifyError(
        `${tested ? `${summary} ` : ""}${t("e2ee.test_failed_keys", {
          keys: failing.join(", "),
        })}`,
        8000,
      );
    } else {
      notifySuccess(summary);
    }
  };

  // Adds the key and binds it to the models typed in the field. Unknown tokens
  // do not abort the import once something matched: the key and the verified
  // bindings are still saved and a message names the entries that matched
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

    const { verified, rejected } = await verifyPairs(
      matched.map((model) => ({ key: entry, model })),
    );
    // A key that fails the test on every model has nothing to encrypt, so it is
    // not stored at all.
    if (matched.length > 0 && verified.length === 0) {
      throw new Error(
        t("e2ee.verify_failed_all", {
          model: rejected[0]?.model.name || rejected[0]?.model.id || "",
          reason: rejected[0]?.reason || t("e2ee.import_error"),
        }),
      );
    }

    const named = {
      ...entry,
      name:
        entry.name ||
        modelKeyName(matched) ||
        t("e2ee.fallback_name", {
          fingerprint: String(entry.kid || entry.id).slice(0, 8),
        }),
      ...(verified.length > 0
        ? testRecord(verified.map(({ model }) => model))
        : {}),
    };
    dispatch(addE2eeKey(named));
    for (const { model } of verified) {
      dispatch(setE2eeModelKey({ modelId: model.id, keyId: named.id }));
    }

    // Only one toast is shown at a time, so everything that went wrong is
    // reported in one message instead of a success toast hiding the warning.
    const problems = [];
    if (unknown.length > 0) {
      problems.push(
        t("e2ee.unknown_models", { models: unknown.join(", ") }),
      );
    }
    if (rejected.length > 0) {
      problems.push(
        t("e2ee.verify_failed_models", {
          models: rejected
            .map(({ model }) => model.name || model.id)
            .join(", "),
          reason: rejected[0].reason,
        }),
      );
    }
    if (problems.length > 0) {
      notifyError(problems.join(" "), 6000);
    } else if (verified.length > 0) {
      notifySuccess(t("e2ee.verified_added", { count: verified.length }));
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
      // A directory carries its own model lists; every incoming key is tested
      // against the models that exist here, and only the pairs that pass are
      // bound. Keys whose model list does not intersect this deployment are
      // still stored, so a directory can be imported ahead of a model rollout.
      const known = new Map(models.map((model) => [model.id, model]));
      const pairs = Object.entries(result.models ?? {})
        .map(([modelId, keyId]) => ({
          key: result.keys.find((entry) => entry.id === keyId),
          model: known.get(modelId),
        }))
        .filter((pair) => pair.key && pair.model);
      const { verified, rejected } = await verifyPairs(pairs);

      // A key that was tested records the result, even when nothing passed: an
      // untested-looking key is better than a green one that never worked.
      const passedByKey = new Map();
      for (const { key, model } of verified) {
        passedByKey.set(key.id, [...(passedByKey.get(key.id) ?? []), model]);
      }
      const testedKeyIds = new Set(pairs.map(({ key }) => key.id));
      for (const key of result.keys) {
        dispatch(
          addE2eeKey({
            ...key,
            ...(testedKeyIds.has(key.id)
              ? testRecord(passedByKey.get(key.id) ?? [])
              : {}),
          }),
        );
      }
      for (const { key, model } of verified) {
        dispatch(setE2eeModelKey({ modelId: model.id, keyId: key.id }));
      }

      const imported = t("e2ee.directory_imported", {
        count: result.keys.length,
      });
      if (rejected.length > 0) {
        notifyError(
          `${imported} ${t("e2ee.verify_failed_models", {
            models: rejected
              .map(({ model }) => model.name || model.id)
              .join(", "),
            reason: rejected[0].reason,
          })}`,
          8000,
        );
      } else {
        notifySuccess(imported);
      }
      resetForm();
    });

  // A local folder of generated `.pub` files: every file is validated, the ones
  // that parse are stored, and each is bound to the model whose published file
  // name it carries. A file that is not a key is reported and skipped.
  const handleFolder = () =>
    run(async () => {
      if (typeof globalThis.showDirectoryPicker !== "function") {
        throw new Error(t("e2ee.folder_unsupported"));
      }
      let handle;
      try {
        handle = await globalThis.showDirectoryPicker({ mode: "read" });
      } catch (caught) {
        // The picker throws AbortError when the user dismisses the dialog.
        if (caught?.name === "AbortError") return;
        throw new Error(
          t("e2ee.folder_error", {
            reason: caught?.message || t("e2ee.import_error"),
          }),
        );
      }

      const { files, errors } = await readKeyFolder(handle);
      if (!files.length) {
        throw new Error(
          errors.length
            ? t("e2ee.folder_no_valid", { count: errors.length })
            : t("e2ee.folder_empty"),
        );
      }

      // A file name is the model id processed by publishedKeyFileName(), so the
      // mapping back is a lookup over the models this deployment offers.
      const imported = new Map();
      const pairs = [];
      for (const { fileName, key } of files) {
        const matched = models.filter(
          (model) => publishedKeyFileName(model.id) === fileName,
        );
        for (const model of matched) pairs.push({ key, model });
        imported.set(key.id, {
          key,
          name: matched[0]?.name || key.name,
        });
      }

      // Same rule as every other import: a key bound to a model is bound only
      // after a sealed request to that model succeeds.
      const { verified, rejected } = await verifyPairs(pairs);

      // Same rule as the directory: the result is kept per key, so a key whose
      // models all failed is visibly failed instead of looking untested.
      const passedByKey = new Map();
      for (const { key, model } of verified) {
        passedByKey.set(key.id, [...(passedByKey.get(key.id) ?? []), model]);
      }
      const testedKeyIds = new Set(pairs.map(({ key }) => key.id));

      for (const { key, name } of imported.values()) {
        dispatch(
          addE2eeKey({
            ...key,
            name,
            ...(testedKeyIds.has(key.id)
              ? testRecord(passedByKey.get(key.id) ?? [])
              : {}),
          }),
        );
      }
      for (const { key, model } of verified) {
        dispatch(setE2eeModelKey({ modelId: model.id, keyId: key.id }));
      }
      // Only one toast can be active at a time (the hook ignores a second one),
      // so a partial import is reported as a single, longer-lived message.
      let message = errors.length
        ? t("e2ee.folder_partial", {
            count: imported.size,
            bound: verified.length,
            skipped: errors.length,
            files: errors
              .slice(0, 3)
              .map((error) => `${error.fileName}: ${error.reason}`)
              .join("; "),
          })
        : t("e2ee.folder_imported", {
            count: imported.size,
            bound: verified.length,
          });
      if (rejected.length > 0) {
        message += ` ${t("e2ee.verify_failed_models", {
          models: rejected
            .map(({ model }) => model.name || model.id)
            .join(", "),
          reason: rejected[0].reason,
        })}`;
      }
      if (errors.length || rejected.length) {
        notifyError(message, 8000);
      } else {
        notifySuccess(message);
      }
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

        // Only a key that passed is stored, so its record is a pass. Grouping by
        // key id keeps one shared key's models in one entry.
        const passedByKey = new Map();
        for (const { model, key } of verified) {
          const group = passedByKey.get(key.id) ?? { key, models: [] };
          group.models.push(model);
          passedByKey.set(key.id, group);
        }
        for (const { key, models: keyModels } of passedByKey.values()) {
          dispatch(addE2eeKey({ ...key, ...testRecord(keyModels) }));
          for (const model of keyModels) {
            dispatch(setE2eeModelKey({ modelId: model.id, keyId: key.id }));
          }
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

  const keyState = (entry) => {
    if (!usableKey(entry)) return "invalid";
    if (!entry.testedAt) return "untested";
    return Array.isArray(entry.testedModels) && entry.testedModels.length
      ? "working"
      : "failed";
  };

  const testHint = (entry, bound) => {
    if (!usableKey(entry)) return t("e2ee.invalid_key");
    if (!bound.length) return t("e2ee.test_no_models");
    return t("e2ee.test");
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="text-xs leading-relaxed text-base-content/70">
        {t("e2ee.description")}
      </p>

      <section className="flex flex-col gap-3" data-guide="e2ee-add">
        <div className="flex items-center gap-2">
          <Upload className="h-4 w-4 text-accent" aria-hidden="true" />
          <h3 className="text-sm font-medium text-base-content">
            {t("e2ee.add_keys_title")}
          </h3>
        </div>
        <p className="text-xs leading-relaxed text-base-content/70">
          {t("e2ee.add_keys_description")}
        </p>
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
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={handleFolder}
                  disabled={busy}
                >
                  <FolderOpen className="h-4 w-4" aria-hidden="true" />
                  {t("e2ee.choose_folder")}
                </button>
                <span className="text-xs text-base-content/60">
                  {t("e2ee.folder_hint")}
                </span>
              </div>
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

        {models.length === 0 ? (
          <p className="text-xs text-base-content/60">{t("common.loading")}</p>
        ) : functionModels.length === 0 ? (
          <p className="text-xs text-base-content/60">{t("e2ee.models_empty")}</p>
        ) : (
          <>
            <p className="text-xs leading-relaxed text-base-content/70">
              {t("e2ee.models_description")}
            </p>
            <ul className="flex flex-col divide-y divide-base-300 rounded-lg border border-base-300">
              {functionModels.map((model) => {
                const assigned = assignments[model.id];
                const features = model.features;
                return (
                  <li
                    key={model.id}
                    className="flex flex-wrap items-center gap-3 px-3 py-2"
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span
                        className="truncate text-sm text-base-content"
                        title={model.id}
                      >
                        {model.name || model.id}
                      </span>
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
                    </span>
                    {model.missing ? (
                      <span
                        className="badge badge-warning badge-sm"
                        title={t("e2ee.model_not_offered_hint")}
                      >
                        {t("e2ee.model_not_offered")}
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
          </>
        )}
      </section>

      <section className="flex flex-col gap-3" data-guide="e2ee-keys">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-accent" aria-hidden="true" />
            <h3 className="text-sm font-medium text-base-content">
              {t("e2ee.keys_title")}
            </h3>
          </div>
          {keys.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={handleTestAll}
                disabled={testing !== null || busy}
              >
                {testing === "all" ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {t("e2ee.test_all")}
              </button>
              {confirmClearAll ? (
                <>
                  <span className="text-xs text-base-content/70">
                    {t("e2ee.clear_all_confirm")}
                  </span>
                  <button
                    type="button"
                    className="btn btn-error btn-xs"
                    onClick={() => {
                      dispatch(clearE2eeKeys());
                      setConfirmClearAll(false);
                      notifySuccess(t("e2ee.clear_all_done"));
                    }}
                  >
                    {t("e2ee.clear_all")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => setConfirmClearAll(false)}
                  >
                    {t("common.cancel")}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost btn-xs text-error"
                  onClick={() => setConfirmClearAll(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("e2ee.clear_all")}
                </button>
              )}
            </div>
          )}
        </div>

        {keys.length === 0 ? (
          <p className="text-xs text-base-content/60">{t("e2ee.no_keys")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-base-300 rounded-lg border border-base-300">
            {keys.map((entry) => {
              const usable = usableKey(entry);
              const state = keyState(entry);
              const bound = boundModelsFor(entry);
              const statusTitle = {
                working: t("e2ee.status_working_hint", {
                  count: entry.testedModels?.length ?? 0,
                }),
                failed: t("e2ee.status_failed_hint"),
                untested: t("e2ee.status_untested_hint"),
              }[state];
              return (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center gap-3 px-3 py-2.5"
                >
                  <ShieldCheck
                    className={`h-4 w-4 shrink-0 ${KEY_STATE_ICON[state]}`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-sm text-base-content">
                        {entry.name || entry.id}
                      </span>
                      {usable && (
                        <span
                          className={`badge badge-sm ${KEY_STATE_BADGE[state]}`}
                          title={statusTitle}
                        >
                          {t(`e2ee.status_${state}`)}
                        </span>
                      )}
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
                    onClick={() => handleTest(entry)}
                    disabled={
                      testing !== null || busy || !usable || bound.length === 0
                    }
                    title={testHint(entry, bound)}
                    aria-label={t("e2ee.test")}
                  >
                    {testing === entry.id ? (
                      <span className="loading loading-spinner loading-xs" />
                    ) : (
                      <FlaskConical className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
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
      </section>
    </div>
  );
}
