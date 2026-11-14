import { useState } from "react";
import { useTranslation } from "react-i18next";

import BaseModal from "../BaseModal";

export default function CreateEntryModal({
  isOpen,
  onClose,
  kind = "file",
  path = "/",
  onCreate,
  initialName = "",
  titleKey,
  confirmKey,
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    if (trimmed.includes("/")) {
      setError(t("workspace.entry_name_invalid"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onCreate?.(trimmed);
      setName("");
      onClose();
    } catch (event) {
      setError(event instanceof Error ? event.message : String(event));
    } finally {
      setSaving(false);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey={
        titleKey ??
        (kind === "dir" ? "workspace.new_folder" : "workspace.new_file")
      }
    >
      <div className="flex flex-col gap-3 pb-2 text-sm">
        <p className="text-xs text-base-content/60">
          {t("workspace.create_in", { path })}
        </p>
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
          placeholder={
            kind === "dir"
              ? t("workspace.folder_name_placeholder")
              : t("workspace.file_name_placeholder")
          }
          className="input input-bordered w-full"
        />
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
            {confirmKey
              ? t(confirmKey)
              : kind === "dir"
                ? t("workspace.new_folder")
                : t("workspace.new_file")}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
