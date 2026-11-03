import { Idea } from "@carbon/icons-react";
import { useTranslation } from "react-i18next";

import { buildUseCaseGuide } from "../../config/useCases";
import { useFeatureGuide } from "../../context/FeatureGuideContext";

export default function UseCaseGuideCard({ useCaseId }) {
  const { t } = useTranslation();
  const { startCustomGuide, enabled } = useFeatureGuide();
  const guide = buildUseCaseGuide(useCaseId);

  if (!guide || !enabled) return null;

  return (
    <button
      type="button"
      className="btn btn-accent btn-sm w-fit gap-2"
      onClick={() => startCustomGuide(guide)}
    >
      <Idea size={16} />
      {t("use_cases.catalog.start_walkthrough")}: {t(guide.titleKey)}
    </button>
  );
}
