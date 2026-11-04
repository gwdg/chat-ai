import { Ai } from "@carbon/icons-react";
import { useTranslation } from "react-i18next";

import { getFeatureGuide } from "../../config/featureGuides";
import { useFeatureGuide } from "../../context/FeatureGuideContext";

export default function FeatureGuideCard({ featureId, compact = false }) {
  const { t } = useTranslation();
  const { startGuide, enabled } = useFeatureGuide();
  const guide = getFeatureGuide(featureId);

  if (!guide || !enabled) return null;

  if (compact) {
    return (
      <button
        type="button"
        className="btn btn-accent btn-xs ml-1 inline-flex w-fit gap-1 align-middle"
        onClick={() => startGuide(featureId)}
      >
        <Ai size={12} />
        {t("feature_guide.show_me_short")}
      </button>
    );
  }

  return (
    <button
      type="button"
      className="btn btn-accent btn-sm w-fit gap-2"
      onClick={() => startGuide(featureId)}
    >
      <Ai size={16} />
      {t("feature_guide.show_me", { title: t(guide.titleKey) })}
    </button>
  );
}
