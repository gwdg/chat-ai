import { useState } from "react";
import { Trans } from "react-i18next";
import { useDispatch } from "react-redux";
import BaseModal from "../BaseModal";
import { setWarning } from "../../Redux/reducers/interfaceSettingsSlice";

/**
 * Confirmation dialog for a single action, opened via `confirmAction` from the
 * modal context.
 *
 * Props:
 * - messageKey (string): i18n key explaining what the action does
 * - confirmKey (string): i18n key for the confirm button label
 * - warningKey (string): interface setting that keeps this dialog enabled;
 *   ticking "don't show this again" and confirming turns it off for good
 * - danger (boolean): style the confirm button as destructive
 * - onConfirm (function): runs when the user confirms
 */
export default function ConfirmActionModal({
  isOpen,
  onClose,
  messageKey,
  confirmKey,
  warningKey,
  danger = false,
  onConfirm,
}) {
  const dispatch = useDispatch();
  const [dontShowAgain, setDontShowAgain] = useState(false);

  // Only remember the choice once the action is actually confirmed.
  const handleConfirm = () => {
    if (dontShowAgain) dispatch(setWarning({ key: warningKey, value: false }));
    onConfirm();
    onClose();
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} titleKey="alert.title">
      {/* Message */}
      <div className="pt-0 pb-2">
        <p className="text-base-content text-justify text-sm">
          <Trans i18nKey={messageKey} />
        </p>
      </div>

      {/* Checkbox */}
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id={`dontShowAgain-${warningKey}`}
          checked={dontShowAgain}
          onChange={(event) => setDontShowAgain(event.target.checked)}
          className="checkbox checkbox-accent checkbox-sm"
        />
        <label
          htmlFor={`dontShowAgain-${warningKey}`}
          className="text-sm text-base-content cursor-pointer select-none"
        >
          <Trans i18nKey="common.dont_show_again" />
        </label>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col md:flex-row gap-2 justify-between w-full text-sm mt-4">
        {/* Cancel button */}
        <button
          className="btn md:w-fit w-full min-w-[130px] select-none"
          onClick={onClose}
        >
          <Trans i18nKey="common.cancel" />
        </button>

        {/* Confirm button */}
        <button
          className={`btn md:w-fit w-full min-w-[130px] select-none ${
            danger ? "btn-error" : "btn-accent"
          }`}
          onClick={handleConfirm}
        >
          <Trans i18nKey={confirmKey} />
        </button>
      </div>
    </BaseModal>
  );
}
