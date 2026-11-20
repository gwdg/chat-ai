// The green lock that marks a model whose traffic is end-to-end encrypted.
//
// It reads the same registry the request wrapper does, so the badge and the
// actual sealing can never disagree: a model shows the lock exactly when its
// requests are sealed.
import { Lock } from "lucide-react";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";

import {
  selectE2eeKeys,
  selectE2eeModels,
} from "../../Redux/reducers/userSettingsReducer";
import { isModelKeyed } from "../../e2ee/registry";

/**
 * Renders nothing when the model is unkeyed.
 *
 * `size` is the icon edge in px; `showLabel` adds the translated "End-to-end
 * encrypted" text for rows that have room for it.
 */
export default function E2eeLock({ modelId, size = 12, showLabel = false, className = "" }) {
  const { t } = useTranslation();
  const keys = useSelector(selectE2eeKeys);
  const models = useSelector(selectE2eeModels);

  if (!isModelKeyed({ keys, models }, modelId)) return null;

  const label = t("e2ee.badge");
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 text-success ${className}`}
      title={label}
      aria-label={label}
    >
      <Lock size={size} strokeWidth={2.5} aria-hidden="true" />
      {showLabel && <span className="text-[0.7rem] font-medium">{label}</span>}
    </span>
  );
}
