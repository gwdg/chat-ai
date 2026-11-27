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
 * - messageValues (object): values for that i18n message (count, group, …)
 * - confirmKey (string): i18n key for the confirm button label
 * - warningKey (string): interface setting that keeps this dialog enabled;
 *   ticking "don't show this again" and confirming turns it off for good
 * - showDontShowAgain (boolean): hide the "don't show this again" checkbox, for
 *   actions that must always be confirmed
 * - danger (boolean): style the confirm button as destructive
 * - onConfirm (function): runs when the user confirms
 * - onCancel (function): runs when the dialog is dismissed without confirming,
 *   so a caller that awaits the answer is not left hanging
 */
export default function ConfirmActionModal({
  isOpen,
  onClose,
  messageKey,
  messageValues,
  confirmKey,
  warningKey,
  showDontShowAgain = true,
  danger = false,
  onConfirm,
  onCancel,
}) {
  const dispatch = useDispatch();
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const cancel = () => {
    onCancel?.();
    onClose();
  };

  // Only remember the choice once the action is actually confirmed.
  const handleConfirm = () => {
    if (dontShowAgain && warningKey) {
      dispatch(setWarning({ key: warningKey, value: false }));
    }
    onConfirm();
    onClose();
  };

  return (
    <BaseModal isOpen={isOpen} onClose={cancel} titleKey="alert.title">
      {/* Message */}
      <div className="pt-0 pb-2">
        <p className="text-base-content text-justify text-sm">
          <Trans i18nKey={messageKey} values={messageValues} />
        </p>
      </div>

      {/* Checkbox */}
      {showDontShowAgain && warningKey && (
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
      )}

      {/* Action buttons */}
      <div className="flex flex-col md:flex-row gap-2 justify-between w-full text-sm mt-4">
        {/* Cancel button */}
        <button
          className="btn md:w-fit w-full min-w-[130px] select-none"
          onClick={cancel}
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
