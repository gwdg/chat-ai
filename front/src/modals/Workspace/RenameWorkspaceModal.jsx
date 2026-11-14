import { useState } from "react";
import { useTranslation } from "react-i18next";

import BaseModal from "../BaseModal";
import { updateWorkspace } from "../../db/workspaceDb";

export default function RenameWorkspaceModal({
  isOpen,
  onClose,
  workspaceId,
  initialName = "",
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setError("");
    try {
      await updateWorkspace(workspaceId, { name: trimmed });
      onClose();
    } catch (event) {
      const message = event instanceof Error ? event.message : String(event);
      setError(
        message.includes("required")
          ? t("workspace.name_required")
          : message.includes("already exists")
            ? t("workspace.name_taken")
            : message,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey="workspace.edit_title"
    >
      <div className="flex flex-col gap-3 pb-2 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-base-content/70">
            {t("workspace.name_label")}
          </span>
          <input
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void submit();
              }
            }}
            autoFocus
            className="input input-bordered w-full"
          />
        </label>
        {error && <p className="text-xs text-error">{error}</p>}
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="btn btn-accent"
            onClick={submit}
            disabled={!name.trim() || saving}
          >
            {t("common.save")}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
