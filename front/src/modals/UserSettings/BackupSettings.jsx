import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, TriangleAlert, Upload } from "lucide-react";

import {
  createBackup,
  inspectBackup,
  restoreBackup,
} from "../../backup/package";
import { MIN_BACKUP_PASSPHRASE_LENGTH } from "../../backup/crypto";
import { downloadText } from "../../utils/download";

/**
 * Data tab → encrypted backup.
 *
 * Unlike the encrypted server synchronization this needs no module flag and no account:
 * it builds one file from the local database, encrypts it in this browser and
 * hands it to the download. Restore goes through the same namespaces, so the
 * result is the same shape a sync pull would produce.
 */
export default function BackupSettings() {
  const { t } = useTranslation();
  const createIds = useId();
  const restoreIds = useId();

  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState([]);

  const [fileName, setFileName] = useState("");
  const [fileText, setFileText] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [info, setInfo] = useState(null);
  const [restorePassphrase, setRestorePassphrase] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [restoreSkipped, setRestoreSkipped] = useState([]);

  const describeError = (caught) =>
    caught instanceof Error ? caught.message : String(caught);

  const resetFeedback = () => {
    setError("");
    setMessage("");
    setRestoreSkipped([]);
  };

  const create = async () => {
    resetFeedback();
    setCreated([]);
    if (!passphrase) {
      setError(t("user_settings.data.backup.missing_passphrase"));
      return;
    }
    if (passphrase !== confirm) {
      setError(t("user_settings.data.backup.mismatch"));
      return;
    }
    setCreating(true);
    try {
      const result = await createBackup(passphrase);
      downloadText(result.text, "application/json", result.fileName);
      setMessage(
        t("user_settings.data.backup.created", {
          file: result.fileName,
          records: result.records,
        }),
      );
      setCreated(result.skipped);
      setPassphrase("");
      setConfirm("");
    } catch (caught) {
      setError(
        t("user_settings.data.backup.create_error", {
          error: describeError(caught),
        }),
      );
    } finally {
      setCreating(false);
    }
  };

  const chooseFile = async (file) => {
    resetFeedback();
    setInfo(null);
    setFileName("");
    setFileText("");
    setFileSize(0);
    setConfirmed(false);
    if (!file) return;
    setFileName(file.name);
    setFileSize(file.size);
    try {
      const text = await file.text();
      const inspected = inspectBackup(text);
      setFileText(text);
      setInfo(inspected);
    } catch (caught) {
      setError(
        t("user_settings.data.backup.inspect_error", {
          error: describeError(caught),
        }),
      );
    }
  };

  const restore = async () => {
    resetFeedback();
    if (!fileText) {
      setError(t("user_settings.data.backup.choose_file_first"));
      return;
    }
    if (!restorePassphrase) {
      setError(t("user_settings.data.backup.missing_passphrase"));
      return;
    }
    if (!confirmed) {
      setError(t("user_settings.data.backup.confirm_required"));
      return;
    }
    setRestoring(true);
    try {
      const result = await restoreBackup(
        fileText,
        restorePassphrase,
      );
      setMessage(
        t("user_settings.data.backup.restored", {
          records: result.records,
        }),
      );
      setRestoreSkipped(result.skipped);
      if (result.unknownNamespaces.length) {
        setError(
          t("user_settings.data.backup.unknown_namespaces", {
            namespaces: result.unknownNamespaces.join(", "),
          }),
        );
      }
      setRestorePassphrase("");
      setConfirmed(false);
    } catch (caught) {
      setError(
        t("user_settings.data.backup.restore_error", {
          error: describeError(caught),
        }),
      );
    } finally {
      setRestoring(false);
    }
  };

  return (
    <section className="flex flex-col gap-4" data-guide="backup-settings">
      <div>
        <h3 className="text-sm font-medium text-base-content">
          {t("user_settings.data.backup.title")}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-base-content/70">
          {t("user_settings.data.backup.description")}
        </p>
      </div>

      <div className="alert alert-warning items-start text-xs" role="note">
        <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="leading-relaxed">
          {t("user_settings.data.backup.notice")}
        </span>
      </div>

      <div
        className="flex flex-col gap-3 rounded-lg border border-base-300 p-4"
        data-guide="backup-create"
      >
        <div>
          <h4 className="text-sm font-medium">
            {t("user_settings.data.backup.create_title")}
          </h4>
          <p className="mt-1 text-xs leading-relaxed text-base-content/70">
            {t("user_settings.data.backup.create_description")}
          </p>
        </div>

        <div>
          <label
            className="block text-xs font-medium"
            htmlFor={`${createIds}-passphrase`}
          >
            {t("user_settings.data.backup.passphrase")}
          </label>
          <input
            id={`${createIds}-passphrase`}
            type="password"
            autoComplete="new-password"
            className="input input-bordered mt-1 w-full"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
          />
          <p className="mt-1 text-[11px] text-base-content/60">
            {t("user_settings.data.backup.passphrase_hint", {
              count: MIN_BACKUP_PASSPHRASE_LENGTH,
            })}
          </p>
        </div>

        <div>
          <label
            className="block text-xs font-medium"
            htmlFor={`${createIds}-confirm`}
          >
            {t("user_settings.data.backup.passphrase_confirm")}
          </label>
          <input
            id={`${createIds}-confirm`}
            type="password"
            autoComplete="new-password"
            className="input input-bordered mt-1 w-full"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
        </div>

        <button
          type="button"
          className="btn btn-primary btn-sm self-start"
          disabled={creating}
          onClick={() => void create()}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          {creating
            ? t("user_settings.data.backup.creating")
            : t("user_settings.data.backup.create_button")}
        </button>
      </div>

      <div
        className="flex flex-col gap-3 rounded-lg border border-base-300 p-4"
        data-guide="backup-restore"
      >
        <div>
          <h4 className="text-sm font-medium">
            {t("user_settings.data.backup.restore_title")}
          </h4>
          <p className="mt-1 text-xs leading-relaxed text-base-content/70">
            {t("user_settings.data.backup.restore_description")}
          </p>
        </div>

        <div>
          <label
            className="block text-xs font-medium"
            htmlFor={`${restoreIds}-file`}
          >
            {t("user_settings.data.backup.choose_file")}
          </label>
          <input
            id={`${restoreIds}-file`}
            type="file"
            accept=".chataibackup,application/json"
            className="file-input file-input-bordered mt-1 w-full"
            onChange={(event) => void chooseFile(event.target.files?.[0])}
          />
          {fileName && (
            <p className="mt-1 text-[11px] text-base-content/60">
              {fileName} · {Math.max(1, Math.round(fileSize / 1024))} KB
            </p>
          )}
          {info && (
            <p className="mt-1 text-[11px] text-base-content/70">
              {t("user_settings.data.backup.file_summary", {
                date: new Date(info.createdAt).toLocaleString(),
                records: info.counts.records ?? 0,
              })}
            </p>
          )}
        </div>

        <div>
          <label
            className="block text-xs font-medium"
            htmlFor={`${restoreIds}-passphrase`}
          >
            {t("user_settings.data.backup.restore_passphrase")}
          </label>
          <input
            id={`${restoreIds}-passphrase`}
            type="password"
            autoComplete="current-password"
            className="input input-bordered mt-1 w-full"
            value={restorePassphrase}
            onChange={(event) => setRestorePassphrase(event.target.value)}
          />
        </div>

        <label className="flex cursor-pointer items-start gap-2 text-xs leading-relaxed">
          <input
            type="checkbox"
            className="checkbox checkbox-sm mt-0.5"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          <span>{t("user_settings.data.backup.restore_confirm")}</span>
        </label>

        <button
          type="button"
          className="btn btn-outline btn-sm self-start"
          disabled={restoring || !fileText}
          onClick={() => void restore()}
        >
          <Upload className="h-4 w-4" aria-hidden="true" />
          {restoring
            ? t("user_settings.data.backup.restoring")
            : t("user_settings.data.backup.restore_button")}
        </button>
      </div>

      {message && (
        <div className="alert alert-success text-xs" role="status">
          <span>{message}</span>
        </div>
      )}
      {error && (
        <div className="alert alert-error text-xs" role="alert">
          <span>{error}</span>
        </div>
      )}
      {created.length > 0 && (
        <ul className="max-h-24 overflow-auto rounded bg-base-200 p-2 text-[11px] text-base-content/70">
          {created.slice(0, 20).map((entry, index) => (
            <li key={`${entry}-${index}`} className="truncate" title={entry}>
              {entry}
            </li>
          ))}
        </ul>
      )}
      {restoreSkipped.length > 0 && (
        <ul className="max-h-24 overflow-auto rounded bg-base-200 p-2 text-[11px] text-base-content/70">
          {restoreSkipped.slice(0, 20).map((entry, index) => (
            <li key={`${entry}-${index}`} className="truncate" title={entry}>
              {entry}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
