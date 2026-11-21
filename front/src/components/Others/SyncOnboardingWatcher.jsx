import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  dismissSyncOnboarding,
  selectSyncOnboardingDismissed,
} from "../../Redux/reducers/interfaceSettingsSlice";
import { setSyncEnabled } from "../../Redux/reducers/userSettingsReducer";
import {
  SAIA_FS_AVAILABLE,
  useSaiaFsAccess,
} from "../../hooks/useSaiaFsAccess";
import { useUpdateUserData } from "../../hooks/useUpdateUserData";
import { useModal } from "../../modals/ModalContext";
import { hasRemoteVault } from "../../sync/service";
import { isSyncEnabled } from "../../utils/modules";

/**
 * Offer the encrypted server synchronization on first use.
 *
 * The offer belongs to the first run of a build that ships the `sync` module:
 * it is shown only while the module is on, the user has not switched the
 * synchronization on, the offer was never dismissed in this browser, and the
 * SAIA filesystem actually answers. The health probe fails closed, so a
 * deployment without the service never sees the dialog.
 *
 * Before the dialog opens, the remote vault is checked once: another device may
 * already have created the copy for this account. The offer then asks to set
 * *that* copy up here instead of suggesting a second one — accepting still only
 * enables the preference and opens Data settings, where the passphrase is
 * typed. A failed check falls back to the create wording; the panel checks
 * again and offers the unlock form when it finds a copy.
 *
 * Accepting switches the synchronization preference on and opens Data → Server
 * synchronization, where the passphrase is typed and the passkey can be added.
 * Declining (including Escape or a backdrop click) records the decision, so the
 * dialog is not shown again on this device — for either wording.
 */
export default function SyncOnboardingWatcher() {
  const dismissed = useSelector(selectSyncOnboardingDismissed);
  const syncEnabled = useSelector(
    (state) => state.user_settings.sync?.enabled === true,
  );
  const access = useSaiaFsAccess();
  // `null` until the remote check answered: the dialog must not announce
  // "nothing exists yet" before this device knows whether something does.
  const [existing, setExisting] = useState(null);

  const pending =
    isSyncEnabled() && !dismissed && !syncEnabled && access === SAIA_FS_AVAILABLE;

  useEffect(() => {
    if (!pending) return undefined;
    let active = true;
    void hasRemoteVault()
      .then((found) => {
        if (active) setExisting(found);
      })
      .catch(() => {
        // An unreachable filesystem says nothing about a copy, so the create
        // wording is the honest default; SyncSettings checks again.
        if (active) setExisting(false);
      });
    return () => {
      active = false;
    };
  }, [pending]);

  if (!pending || existing === null) return null;
  return <SyncOnboardingOffer existing={existing} />;
}

function SyncOnboardingOffer({ existing }) {
  const dispatch = useDispatch();
  const { openModal, closeModal } = useModal();
  const userData = useUpdateUserData();
  // The dialog is opened once, so its handlers keep the `userData` of that
  // moment. The profile usually arrives after the health probe, so read the
  // latest value through a ref instead of closing over a stale null.
  const userDataRef = useRef(userData);
  userDataRef.current = userData;
  // `openModal` is a new function on every provider render, so the effect must
  // not depend on it alone.
  const opened = useRef(false);

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    openModal("syncOnboarding", {
      existing,
      onAccept: () => {
        dispatch(setSyncEnabled(true));
        dispatch(dismissSyncOnboarding());
        openModal("userSettings", {
          initialTab: "data/sync",
          userData: userDataRef.current,
        });
      },
      onDismiss: () => {
        dispatch(dismissSyncOnboarding());
        closeModal();
      },
    });
  }, [dispatch, openModal, closeModal, existing]);

  return null;
}
