import { useState } from "react";
import { useTranslation } from "react-i18next";

import BaseModal from "../BaseModal";
import { updateWorkspace } from "../../db/workspaceDb";
import {
  DEFAULT_TOPIC_ICON,
  TOPIC_ICONS,
} from "../../components/Sidebar/topicIcons";
import { TOPIC_COLORS } from "../../components/Sidebar/topicColors";

export default function RenameWorkspaceModal({
  isOpen,
  onClose,
  workspaceId,
  initialName = "",
  initialIcon = DEFAULT_TOPIC_ICON.id,
  initialColor = TOPIC_COLORS[0].id,
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);
  const [icon, setIcon] = useState(initialIcon || DEFAULT_TOPIC_ICON.id);
  const [color, setColor] = useState(initialColor || TOPIC_COLORS[0].id);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setError("");
    try {
      await updateWorkspace(workspaceId, { name: trimmed, icon, color });
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
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-base-content/70">
            {t("folders.choose_color")}
          </span>
          <div className="flex flex-wrap gap-2">
            {TOPIC_COLORS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setColor(option.id)}
                aria-label={option.label}
                aria-pressed={color === option.id}
                title={option.label}
                className={`h-6 w-6 rounded-full transition ${
                  color === option.id
                    ? "ring-2 ring-accent ring-offset-2 ring-offset-base-100"
                    : "hover:scale-110"
                }`}
                style={{ backgroundColor: option.hex }}
              />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-base-content/70">
            {t("folders.choose_icon")}
          </span>
          <div className="grid max-h-48 grid-cols-7 gap-1 overflow-y-auto">
            {TOPIC_ICONS.map((item) => {
              const Icon = item.Icon;
              const selected = icon === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setIcon(item.id)}
                  aria-pressed={selected}
                  title={item.label}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                    selected
                      ? "bg-accent text-accent-content"
                      : "bg-base-200 text-base-content/65 hover:bg-base-300"
                  }`}
                >
                  <Icon size={15} />
                </button>
              );
            })}
          </div>
        </div>
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
