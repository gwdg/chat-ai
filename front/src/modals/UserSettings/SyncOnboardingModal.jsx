import { useTranslation } from "react-i18next";
import {
  Cloud,
  Fingerprint,
  KeyRound,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

import BaseModal from "../BaseModal";
import { MIN_PASSPHRASE_LENGTH } from "../../sync/crypto/vault";
import { isPasskeySupported } from "../../sync/passkey";

/**
 * First-run offer of the encrypted server synchronization.
 *
 * It appears once per browser, and only while the `sync` module is on, the SAIA
 * filesystem answers and the user has not switched the synchronization on. With
 * `existing` it offers to set up the copy another device already created for
 * this account; the button opens the Data tab's Server synchronization section
 * either way. Creating or unlocking the copy (and adding the passkey) stays
 * there, because both need a passphrase the user types.
 *
 * The modal only explains and routes. It applies nothing itself, so a user who
 * declines has not enabled or uploaded anything.
 */
export default function SyncOnboardingModal({
  isOpen,
  onAccept,
  onDismiss,
  existing = false,
}) {
  const { t } = useTranslation();
  const passkeySupported = isPasskeySupported();

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onDismiss}
      titleKey={
        existing
          ? "user_settings.data.sync.onboarding_existing_title"
          : "user_settings.data.sync.onboarding_title"
      }
      maxWidth="max-w-xl"
    >
      <div className="space-y-4 text-sm" data-guide="sync-onboarding">
        <p className="leading-relaxed text-base-content">
          {t(
            existing
              ? "user_settings.data.sync.onboarding_existing_intro"
              : "user_settings.data.sync.onboarding_intro",
          )}
        </p>

        <ul className="space-y-3">
          <li className="flex gap-3">
            <ShieldCheck
              className="mt-0.5 h-4 w-4 shrink-0 text-success"
              aria-hidden="true"
            />
            <span className="leading-relaxed text-base-content/80">
              {t("user_settings.data.sync.onboarding_point_encrypted")}
            </span>
          </li>
          <li className="flex gap-3">
            <KeyRound
              className="mt-0.5 h-4 w-4 shrink-0 text-secondary"
              aria-hidden="true"
            />
            <span className="leading-relaxed text-base-content/80">
              {t(
                existing
                  ? "user_settings.data.sync.onboarding_existing_point_passphrase"
                  : "user_settings.data.sync.onboarding_point_passphrase",
                { min: MIN_PASSPHRASE_LENGTH },
              )}
            </span>
          </li>
          {passkeySupported && (
            <li className="flex gap-3">
              <Fingerprint
                className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                aria-hidden="true"
              />
              <span className="leading-relaxed text-base-content/80">
                {t("user_settings.data.sync.onboarding_point_passkey")}
              </span>
            </li>
          )}
          <li className="flex gap-3">
            <Cloud
              className="mt-0.5 h-4 w-4 shrink-0 text-info"
              aria-hidden="true"
            />
            <span className="leading-relaxed text-base-content/80">
              {t(
                existing
                  ? "user_settings.data.sync.onboarding_existing_point_nothing"
                  : "user_settings.data.sync.onboarding_point_nothing",
              )}
            </span>
          </li>
        </ul>

        <p className="text-xs leading-relaxed text-base-content/70">
          {t("user_settings.data.sync.onboarding_where")}
        </p>

        <div className="alert alert-warning items-start text-xs" role="note">
          <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="leading-relaxed">
            {t("user_settings.data.sync.onboarding_privacy")}
          </span>
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:justify-end">
          <button
            type="button"
            className="btn"
            data-guide="sync-onboarding-dismiss"
            onClick={onDismiss}
          >
            {t("user_settings.data.sync.onboarding_later")}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            data-guide="sync-onboarding-setup"
            onClick={onAccept}
          >
            <Fingerprint className="h-4 w-4" aria-hidden="true" />
            {t(
              existing
                ? "user_settings.data.sync.onboarding_existing_setup"
                : "user_settings.data.sync.onboarding_setup",
            )}
          </button>
        </div>

        <p className="text-center text-[11px] text-base-content/60">
          {t("user_settings.data.sync.onboarding_footer")}
        </p>
      </div>
    </BaseModal>
  );
}
