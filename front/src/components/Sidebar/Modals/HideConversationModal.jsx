import { useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import BaseModal from "../../modals/BaseModal";
import { setConversationVisibility } from "../../db";

const BASE_OPTIONS = [
  { value: "none", durationMs: null },
  { value: "1h", durationMs: 60 * 60 * 1000 },
  { value: "1d", durationMs: 24 * 60 * 60 * 1000 },
  { value: "7d", durationMs: 7 * 24 * 60 * 60 * 1000 },
];

export default function HideConversationModal({
  isOpen,
  onClose,
  conversationId,
  conversationTitle,
  notifySuccess,
  notifyError,
  onHidden,
}) {
  const { t } = useTranslation();
  const [selectedValue, setSelectedValue] = useState("none");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const options = useMemo(
    () =>
      BASE_OPTIONS.map((option) => ({
        ...option,
        label: t(`hide_conversation.duration_${option.value}`),
      })),
    [t]
  );

  const handleSubmit = async () => {
    if (!conversationId) return;
    const option = BASE_OPTIONS.find((opt) => opt.value === selectedValue);
    const autoDeleteAt =
      option && typeof option.durationMs === "number"
        ? Date.now() + option.durationMs
        : null;
    try {
      setIsSubmitting(true);
      await setConversationVisibility(conversationId, "hidden", { autoDeleteAt });
      notifySuccess?.(t("hide_conversation.success"));
      onHidden?.(autoDeleteAt);
      onClose();
    } catch (error) {
      console.error("Failed to hide conversation", error);
      notifyError?.(t("hide_conversation.error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey="hide_conversation.title"
      maxWidth="max-w-lg"
    >
      <div className="space-y-4">
        <p className="dark:text-white text-black text-sm">
          <Trans
            i18nKey="hide_conversation.description"
            values={{ title: conversationTitle }}
          />
        </p>

        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
            {t("hide_conversation.duration_label")}
          </label>
          <select
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-bg_secondary_dark px-3 py-2 text-sm text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-tertiary/40"
            value={selectedValue}
            onChange={(e) => setSelectedValue(e.target.value)}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            <Trans i18nKey="hide_conversation.duration_hint" />
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-2 text-sm">
          <button
            className="cursor-pointer px-4 py-3 rounded-lg font-medium text-gray-700 bg-gray-200 border border-gray-300 hover:bg-gray-300 active:scale-95 transition-all duration-200 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600"
            onClick={onClose}
            disabled={isSubmitting}
          >
            <Trans i18nKey="common.cancel" />
          </button>
          <button
            className="cursor-pointer px-4 py-3 rounded-lg font-medium text-white bg-tertiary border border-tertiary hover:bg-tertiary/90 active:scale-95 transition-all duration-200 shadow-md disabled:opacity-60"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? t("common.loading") : t("hide_conversation.confirm")}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
