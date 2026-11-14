import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import BaseModal from "../BaseModal";
import { createWorkspace } from "../../db/workspaceDb";

export default function CreateWorkspaceModal({ isOpen, onClose }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      const id = await createWorkspace(name);
      setName("");
      onClose();
      navigate(`/workspace/${id}`);
    } catch (event) {
      const message = event instanceof Error ? event.message : String(event);
      setError(
        message.includes("already exists")
          ? t("workspace.name_taken")
          : message.includes("required")
            ? t("workspace.name_required")
            : t("workspace.create_error"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} titleKey="workspace.create_title">
      <div className="flex flex-col gap-3 pb-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-base-content/70">
            {t("workspace.name_label")}
          </span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void submit();
              }
            }}
            autoFocus
            placeholder={t("workspace.name_placeholder")}
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
            {t("workspace.create_workspace")}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
