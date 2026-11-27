import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DatabaseZap,
  FilePenLine,
  FileUp,
  Tags,
  Trash2,
} from "lucide-react";

import ApprovalCard from "./ApprovalCard";
import {
  arcanaActionKey,
  arcanaActionReversible,
  arcanaActionSummary,
} from "../../../utils/arcanaActions";

const ICONS = {
  upload_attachment: FileUp,
  write_text_file: FilePenLine,
  delete_file: Trash2,
  start_index: DatabaseZap,
  set_file_tags: Tags,
};

/**
 * The Arcana chat's approval card, below the assistant's answer.
 *
 * The model can only propose; this card is where a proposal becomes real. The
 * provider work lives in `utils/arcanaActionApply`, which is imported on the
 * first click so the chat shell does not carry the saia-rag client, and the
 * captured undo state travels inside the marker, so a proposal in a stored
 * thread can still be reverted after a reload.
 */
export default function ArcanaActionCard({
  actions,
  localState,
  setLocalState,
  message_index,
}) {
  const { t } = useTranslation();
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(
    localState?.messages?.[message_index]?.meta?.actionDecision === "accepted",
  );
  const [reverting, setReverting] = useState(false);
  const [error, setError] = useState("");

  const reversible = actions.every(arcanaActionReversible);

  const setDecision = (decision) => {
    if (message_index === undefined) return;
    setLocalState?.((prev) => {
      const messages = [...prev.messages];
      const message = messages[message_index];
      if (!message) return prev;
      messages[message_index] = {
        ...message,
        meta: { ...(message.meta || {}), actionDecision: decision },
      };
      return { ...prev, messages, flush: true };
    });
  };

  const reasonOf = (result) =>
    (result.failures ?? [])
      .map((failure) => failure.reason)
      .filter(Boolean)
      .join("; ");

  const handleAccept = async () => {
    if (applying || applied) return;
    setApplying(true);
    setError("");
    try {
      const { applyArcanaActions } = await import(
        "../../../utils/arcanaActionApply"
      );
      const result = await applyArcanaActions(actions);
      const failures = result.failures ?? [];
      if (failures.length) {
        setError(
          result.applied.length
            ? t("arcana_chat.action_partial", {
                applied: result.applied.length,
                total: actions.length,
                reason: reasonOf(result),
              })
            : t("arcana_chat.action_error", { reason: reasonOf(result) }),
        );
        return;
      }
      setApplied(true);
      setDecision("accepted");
    } catch (failure) {
      setError(
        t("arcana_chat.action_error", {
          reason: failure?.message || String(failure),
        }),
      );
    } finally {
      setApplying(false);
    }
  };

  const handleRevert = async () => {
    if (!applied || reverting) return;
    setReverting(true);
    setError("");
    try {
      const { revertArcanaActions } = await import(
        "../../../utils/arcanaActionApply"
      );
      const result = await revertArcanaActions(actions);
      if ((result.failures ?? []).length) {
        setError(
          t("arcana_chat.action_error", { reason: reasonOf(result) }),
        );
        return;
      }
      setApplied(false);
      setDecision("rejected");
    } catch (failure) {
      setError(
        t("arcana_chat.action_error", {
          reason: failure?.message || String(failure),
        }),
      );
    } finally {
      setReverting(false);
    }
  };

  const rows = actions.map((action) => {
    const summary = arcanaActionSummary(action);
    return {
      key: arcanaActionKey(action),
      icon: ICONS[action.op],
      text: summary ? t(summary.key, summary.values) : action.op,
    };
  });

  return (
    <ApprovalCard
      rows={rows}
      title={t("arcana_chat.action_title")}
      warning={t("arcana_chat.action_warning")}
      error={error}
      applied={applied}
      reversible={reversible}
      applying={applying}
      reverting={reverting}
      onAccept={handleAccept}
      onRevert={handleRevert}
      acceptGuide="arcana-action-accept"
    />
  );
}
