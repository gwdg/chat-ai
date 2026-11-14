import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import BaseModal from "../BaseModal";
import { renameOpencodeSession } from "../../apis/opencodeAgents";

export default function RenameAgentSessionModal({
  agent,
  session,
  isOpen,
  onClose,
  notifySuccess,
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(session?.title || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    setTitle(session?.title || "");
    setError("");
    const timer = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, [session]);

  const submit = async () => {
    const next = title.trim();
    if (!next) {
      setError(t("rename_conversation.alert_empty"));
      return;
    }
    if (!agent?.id || !session?.id) return;
    setSaving(true);
    try {
      await renameOpencodeSession(agent, session.id, next);
      window.dispatchEvent(
        new CustomEvent("chatai:agent-sessions-changed", {
          detail: { agentId: agent.id },
        }),
      );
      notifySuccess?.(t("agents.session_renamed"));
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setSaving(false);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey="agents.rename_session"
      maxWidth="max-w-md"
    >
      <div className="flex flex-col gap-4">
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            if (error) setError("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void submit();
            } else if (event.key === "Escape") {
              onClose();
            }
          }}
          className={`input w-full ${error ? "input-error" : ""}`}
          placeholder={t("agents.session_name_placeholder")}
        />
        {error && <p className="pl-1 text-sm text-error">{error}</p>}
        <div className="flex w-full justify-end gap-3 pt-2">
          <button className="btn min-w-[100px] select-none" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button
            className="btn btn-accent min-w-[100px] select-none"
            onClick={() => void submit()}
            disabled={saving}
          >
            {saving ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              t("common.rename")
            )}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
