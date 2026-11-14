import { useState } from "react";
import { useTranslation } from "react-i18next";

import BaseModal from "../BaseModal";

export default function MoveToModal({
  isOpen,
  onClose,
  entry,
  sources = [],
  onSelect,
}) {
  const { t } = useTranslation();
  const [targetId, setTargetId] = useState(sources[0]?.id ?? "");

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} titleKey="workspace.move_to">
      <div className="flex flex-col gap-3 pb-2 text-sm">
        <p className="text-xs text-base-content/70">
          {t("workspace.move_to_hint", { name: entry?.name ?? "" })}
        </p>
        {sources.length === 0 ? (
          <p className="text-xs text-base-content/60">
            {t("workspace.move_to_no_targets")}
          </p>
        ) : (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-base-content/70">
              {t("workspace.move_to_target")}
            </span>
            <select
              value={targetId}
              onChange={(event) => setTargetId(event.target.value)}
              className="select select-bordered w-full"
            >
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="btn btn-accent"
            disabled={!targetId}
            onClick={() => {
              onSelect?.(targetId);
              onClose();
            }}
          >
            {t("workspace.transfer_move")}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
