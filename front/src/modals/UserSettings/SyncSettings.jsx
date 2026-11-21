import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import {
  Cloud,
  KeyRound,
  Lock,
  RefreshCw,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Unlock,
} from "lucide-react";

import {
  selectUserSettings,
  setSyncAuto,
  setSyncEnabled,
} from "../../Redux/reducers/userSettingsReducer";
import { MIN_PASSPHRASE_LENGTH } from "../../sync/crypto/vault";
import {
  changeSyncPassphrase,
  cleanUpRemote,
  createSyncVault,
  hasRemoteVault,
  lockSyncVault,
  rotateSyncVault,
  runSyncIfUnlocked,
  syncNow,
  unlockSyncVault,
} from "../../sync/service";
import { useSyncEngine } from "../../hooks/useSyncEngine";
import { isSyncEnabled } from "../../utils/modules";
import ProfilePreferenceSwitch from "./ProfilePreferenceSwitch";

/**
 * Data tab → encrypted server synchronization.
 *
 * Nothing is written until the user has read the encryption note, chosen a
 * passphrase and pressed Create (or unlocked a copy another device created).
 * The passphrase, the vault key and the device id never enter Redux.
 */
export default function SyncSettings() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const settings = useSelector(selectUserSettings);
  const status = useSyncEngine();
  const enabled = settings?.sync?.enabled === true;
  const auto = settings?.sync?.auto !== false;

  const [remoteExists, setRemoteExists] = useState(false);
  const [checking, setChecking] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [nextPassphrase, setNextPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const refreshRemote = useCallback(async () => {
    if (!isSyncEnabled()) return;
    setChecking(true);
    try {
      setRemoteExists(await hasRemoteVault());
    } catch {
      setRemoteExists(false);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled || status.unlocked) return;
    void refreshRemote();
  }, [enabled, status.unlocked, refreshRemote]);

  if (!isSyncEnabled()) return null;

  const validate = (value, repeated) => {
    if (!value) {
      setError(t("user_settings.data.sync.missing_passphrase"));
      return false;
    }
    if (repeated !== undefined && value !== repeated) {
      setError(t("user_settings.data.sync.mismatch"));
      return false;
    }
    return true;
  };

  const run = async (action, done) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      if (done) setMessage(done);
    } catch (caught) {
      setError(
        t("user_settings.data.sync.error", {
          error: caught instanceof Error ? caught.message : String(caught),
        }),
      );
    } finally {
      setBusy(false);
    }
  };

  const create = (replace = false) => {
    if (!validate(passphrase, confirm)) return;
    void run(async () => {
      await createSyncVault(passphrase, { replace });
      setPassphrase("");
      setConfirm("");
      runSyncIfUnlocked();
    });
  };

  const unlock = () => {
    if (!validate(passphrase)) return;
    void run(async () => {
      await unlockSyncVault(passphrase);
      setPassphrase("");
      setRemoteExists(true);
    });
  };

  const changePassphrase = () => {
    if (!validate(nextPassphrase)) return;
    void run(async () => {
      await changeSyncPassphrase(nextPassphrase);
      setNextPassphrase("");
    }, t("user_settings.data.sync.changed"));
  };

  const rotate = () => {
    if (!validate(passphrase, confirm)) return;
    void run(async () => {
      await rotateSyncVault(passphrase);
      setPassphrase("");
      setConfirm("");
      await syncNow();
    }, t("user_settings.data.sync.rotated"));
  };

  const cleanup = () => {
    void run(async () => {
      const removed = await cleanUpRemote();
      setMessage(
        t("user_settings.data.sync.cleanup_done", {
          records: removed.records,
          assets: removed.assets,
        }),
      );
    });
  };

  const disable = () => {
    dispatch(setSyncEnabled(false));
    lockSyncVault();
  };

  const summary = status.lastSummary;
  const lastSync = status.lastRunAt
    ? new Date(status.lastRunAt).toLocaleString()
    : t("user_settings.data.sync.never");

  return (
    <section className="flex flex-col gap-4" data-guide="sync-settings">
      <div>
        <h3 className="text-sm font-medium text-base-content">
          {t("user_settings.data.sync.title")}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-base-content/70">
          {t("user_settings.data.sync.description")}
        </p>
      </div>

      <div className="alert alert-warning items-start text-xs" role="note">
        <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="leading-relaxed">
          {t("user_settings.data.sync.notice")}
        </span>
      </div>

      <div data-guide="sync-enable">
        <ProfilePreferenceSwitch
          label={t("user_settings.data.sync.enable_label")}
          description={t("user_settings.data.sync.enable_description")}
          checked={enabled}
          onChange={(checked) => {
            if (checked) dispatch(setSyncEnabled(true));
            else disable();
          }}
        />
      </div>

      {enabled && !status.unlocked && (
        <div className="rounded-lg border border-base-300 p-4">
          <h4 className="text-sm font-medium">
            {remoteExists
              ? t("user_settings.data.sync.unlock_title")
              : t("user_settings.data.sync.create_title")}
          </h4>
          <p className="mt-1 text-xs leading-relaxed text-base-content/70">
            {remoteExists
              ? t("user_settings.data.sync.unlock_description")
              : t("user_settings.data.sync.create_description")}
          </p>

          <label className="mt-3 block text-xs font-medium" htmlFor="sync-passphrase">
            {t("user_settings.data.sync.passphrase")}
          </label>
          <input
            id="sync-passphrase"
            type="password"
            autoComplete="new-password"
            className="input input-bordered mt-1 w-full"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
          />
          <p className="mt-1 text-[11px] text-base-content/60">
            {t("user_settings.data.sync.passphrase_hint", {
              count: MIN_PASSPHRASE_LENGTH,
            })}
          </p>

          {!remoteExists && (
            <>
              <label
                className="mt-3 block text-xs font-medium"
                htmlFor="sync-passphrase-confirm"
              >
                {t("user_settings.data.sync.passphrase_confirm")}
              </label>
              <input
                id="sync-passphrase-confirm"
                type="password"
                autoComplete="new-password"
                className="input input-bordered mt-1 w-full"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
              />
            </>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {remoteExists ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={unlock}
              >
                <Unlock className="h-4 w-4" aria-hidden="true" />
                {t("user_settings.data.sync.unlock_button")}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() => create(false)}
              >
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                {t("user_settings.data.sync.create_button")}
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy || checking}
              onClick={() => void refreshRemote()}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {checking
                ? t("user_settings.data.sync.checking")
                : t("user_settings.data.sync.check_again")}
            </button>
          </div>

          {remoteExists && (
            <div className="mt-4 rounded-lg border border-warning/40 bg-warning/10 p-3">
              <p className="text-[11px] leading-relaxed text-base-content/80">
                {t("user_settings.data.sync.exists_hint")}
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-base-content/80">
                {t("user_settings.data.sync.replace_warning")}
              </p>
              <label
                className="mt-3 block text-xs font-medium"
                htmlFor="sync-replace-confirm"
              >
                {t("user_settings.data.sync.passphrase_confirm")}
              </label>
              <input
                id="sync-replace-confirm"
                type="password"
                autoComplete="new-password"
                className="input input-bordered mt-1 w-full"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
              />
              <button
                type="button"
                className="btn btn-warning btn-outline btn-sm mt-3"
                disabled={busy}
                onClick={() => create(true)}
              >
                {t("user_settings.data.sync.replace_button")}
              </button>
            </div>
          )}
        </div>
      )}

      {enabled && status.unlocked && (
        <div className="flex flex-col gap-4 rounded-lg border border-base-300 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-medium text-success">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              {t("user_settings.data.sync.unlocked_title")}
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={busy || status.running}
              onClick={() => void run(() => syncNow())}
            >
              <RefreshCw
                className={`h-4 w-4 ${status.running ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              {status.running
                ? t("user_settings.data.sync.syncing")
                : t("user_settings.data.sync.sync_now")}
            </button>
          </div>

          <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            <div className="flex justify-between gap-2 rounded bg-base-200 px-3 py-2">
              <dt className="text-base-content/60">
                {t("user_settings.data.sync.vault")}
              </dt>
              <dd className="truncate font-mono" title={status.vaultId ?? ""}>
                {status.fingerprint || status.vaultId || "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-2 rounded bg-base-200 px-3 py-2">
              <dt className="text-base-content/60">
                {t("user_settings.data.sync.device")}
              </dt>
              <dd className="truncate font-mono" title={status.deviceId ?? ""}>
                {(status.deviceId ?? "—").slice(0, 8)}
              </dd>
            </div>
            <div className="flex justify-between gap-2 rounded bg-base-200 px-3 py-2">
              <dt className="text-base-content/60">
                {t("user_settings.data.sync.last_sync")}
              </dt>
              <dd>{lastSync}</dd>
            </div>
            <div className="flex justify-between gap-2 rounded bg-base-200 px-3 py-2">
              <dt className="text-base-content/60">
                {t("user_settings.data.sync.conflicts")}
              </dt>
              <dd>{summary?.conflicts.length ?? status.conflicts}</dd>
            </div>
            <div className="flex justify-between gap-2 rounded bg-base-200 px-3 py-2">
              <dt className="text-base-content/60">
                {t("user_settings.data.sync.skipped")}
              </dt>
              <dd>{summary?.skipped.length ?? status.skipped}</dd>
            </div>
          </dl>

          {(summary?.conflicts.length ?? 0) > 0 && (
            <p className="text-[11px] leading-relaxed text-base-content/70">
              {t("user_settings.data.sync.conflict_hint")}
            </p>
          )}
          {(summary?.skipped.length ?? 0) > 0 && (
            <ul className="max-h-24 overflow-auto rounded bg-base-200 p-2 text-[11px] text-base-content/70">
              {summary?.skipped.slice(0, 20).map((entry, index) => (
                <li key={`${entry}-${index}`} className="truncate" title={entry}>
                  {entry}
                </li>
              ))}
            </ul>
          )}

          <ProfilePreferenceSwitch
            label={t("user_settings.data.sync.auto_label")}
            description={t("user_settings.data.sync.auto_description")}
            checked={auto}
            onChange={(checked) => dispatch(setSyncAuto(checked))}
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                lockSyncVault();
                setMessage("");
                setError("");
              }}
            >
              <Lock className="h-4 w-4" aria-hidden="true" />
              {t("user_settings.data.sync.lock")}
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={busy}
              onClick={cleanup}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              {t("user_settings.data.sync.cleanup")}
            </button>
          </div>
          <p className="text-[11px] leading-relaxed text-base-content/60">
            {t("user_settings.data.sync.cleanup_description")}
          </p>

          <details className="rounded-lg border border-base-300 p-3">
            <summary className="cursor-pointer text-xs font-medium">
              {t("user_settings.data.sync.change_title")}
            </summary>
            <label
              className="mt-3 block text-xs font-medium"
              htmlFor="sync-next-passphrase"
            >
              {t("user_settings.data.sync.passphrase")}
            </label>
            <input
              id="sync-next-passphrase"
              type="password"
              autoComplete="new-password"
              className="input input-bordered mt-1 w-full"
              value={nextPassphrase}
              onChange={(event) => setNextPassphrase(event.target.value)}
            />
            <button
              type="button"
              className="btn btn-primary btn-sm mt-3"
              disabled={busy}
              onClick={changePassphrase}
            >
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              {t("user_settings.data.sync.change_button")}
            </button>
          </details>

          <details className="rounded-lg border border-warning/40 p-3">
            <summary className="cursor-pointer text-xs font-medium text-warning">
              {t("user_settings.data.sync.rotate_title")}
            </summary>
            <p className="mt-2 text-[11px] leading-relaxed text-base-content/70">
              {t("user_settings.data.sync.rotate_description")}
            </p>
            <label
              className="mt-3 block text-xs font-medium"
              htmlFor="sync-rotate-passphrase"
            >
              {t("user_settings.data.sync.passphrase")}
            </label>
            <input
              id="sync-rotate-passphrase"
              type="password"
              autoComplete="new-password"
              className="input input-bordered mt-1 w-full"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
            />
            <label
              className="mt-3 block text-xs font-medium"
              htmlFor="sync-rotate-confirm"
            >
              {t("user_settings.data.sync.passphrase_confirm")}
            </label>
            <input
              id="sync-rotate-confirm"
              type="password"
              autoComplete="new-password"
              className="input input-bordered mt-1 w-full"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
            <button
              type="button"
              className="btn btn-warning btn-sm mt-3"
              disabled={busy}
              onClick={rotate}
            >
              {t("user_settings.data.sync.rotate_button")}
            </button>
          </details>

          <p className="text-[11px] leading-relaxed text-base-content/60">
            {t("user_settings.data.sync.disable_hint")}
          </p>
        </div>
      )}

      {status.error && (
        <div className="alert alert-error text-xs" role="alert">
          <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{t("user_settings.data.sync.error", { error: status.error })}</span>
        </div>
      )}
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

      {!status.unlocked && !enabled && (
        <p className="flex items-start gap-2 text-[11px] leading-relaxed text-base-content/60">
          <Cloud className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {t("user_settings.data.sync.disable_hint")}
        </p>
      )}
    </section>
  );
}
