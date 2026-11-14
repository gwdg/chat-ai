import { useTranslation } from "react-i18next";

import BaseModal from "../BaseModal";
import { formatBytes } from "../../utils/formatBytes";

export default function TransferConfirmModal({
  isOpen,
  onClose,
  plan,
  fromLabel,
  toLabel,
  onConfirm,
}) {
  const { t } = useTranslation();

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} titleKey="workspace.transfer_title">
      <div className="flex flex-col gap-3 pb-2 text-sm">
        <p className="text-base-content">
          {t("workspace.transfer_summary", {
            strategy:
              plan?.strategy === "move"
                ? t("workspace.transfer_move")
                : t("workspace.transfer_copy"),
            from: fromLabel,
            to: toLabel,
            count: plan?.itemCount ?? 0,
            size: formatBytes(plan?.totalBytes ?? 0),
          })}
        </p>
        <p className="text-xs text-base-content/70">
          {plan?.strategy === "move"
            ? t("workspace.transfer_move_note")
            : t("workspace.transfer_copy_note")}
        </p>
        {Array.isArray(plan?.warnings) &&
          plan.warnings.map((warning) => (
            <p key={warning} className="text-xs text-warning">
              {warning}
            </p>
          ))}
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="btn btn-accent"
            onClick={() => {
              onConfirm?.();
              onClose();
            }}
          >
            {plan?.strategy === "move"
              ? t("workspace.transfer_move")
              : t("workspace.transfer_copy")}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
