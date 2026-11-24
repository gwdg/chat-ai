import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";

import BaseModal from "../../../modals/BaseModal";
import { deleteConversation } from "../../../db";
import { useToast } from "../../../hooks/useToast";

/**
 * Bulk removal of the Unsorted Chats bucket.
 *
 * "Unsorted" is a sidebar grouping, not a topic row, so there is nothing to
 * delete on its own: every chat in it is deleted. The dialog always asks first
 * because the action cannot be undone.
 */
export default function DeleteUnsortedChatsModal({
  conversations = [],
  currentConversationId,
  isOpen,
  onClose,
  notifySuccess,
}) {
  const { t } = useTranslation();
  const { notifySuccess: toastSuccess, notifyError } = useToast();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [busy, setBusy] = useState(false);

  const ids = conversations.map((conversation) => conversation?.id).filter(Boolean);
  const count = ids.length;

  const handleDelete = async () => {
    if (busy || count === 0) return;
    setBusy(true);
    try {
      for (const id of ids) {
        await deleteConversation(id);
      }
      const removedOpenChat =
        ids.includes(currentConversationId) ||
        ids.some((id) => pathname === `/chat/${id}`);
      // The page would otherwise keep rendering a chat that no longer exists.
      if (removedOpenChat) navigate("/chat/");
      (notifySuccess ?? toastSuccess)?.(
        t("folders.removed_unsorted_chats", { count }),
      );
      onClose();
    } catch (error) {
      notifyError(
        t("folders.remove_unsorted_error", {
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey="folders.delete_unsorted_title"
      maxWidth="max-w-md"
    >
      <div className="space-y-4 text-sm">
        <p className="text-base-content">
          <Trans
            i18nKey="folders.delete_unsorted_description"
            values={{ count }}
          />
        </p>
        <div className="flex flex-col md:flex-row gap-2 justify-end">
          <button type="button" className="btn" onClick={onClose}>
            <Trans i18nKey="common.cancel" />
          </button>
          <button
            type="button"
            className="btn btn-error"
            disabled={busy || count === 0}
            onClick={handleDelete}
          >
            <Trans i18nKey="folders.remove_all_unsorted" />
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
