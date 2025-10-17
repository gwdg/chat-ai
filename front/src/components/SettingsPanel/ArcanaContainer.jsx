// components/settings/ArcanaContainer.jsx
import { Trans, useTranslation } from "react-i18next";
import { HelpCircle } from "lucide-react";
import { useModal } from "../../modals/ModalContext";

const ArcanaContainer = ({ localState, setLocalState }) => {
  const { t } = useTranslation();
  const { openModal } = useModal();
  const settings = localState.settings;

  const handleArcanaChange = () => (e) => {
    setLocalState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        arcana: {
          ...prev.settings.arcana,
          id: e.target.value,
        },
      },
    }));
  };

  const currentModel = settings.model;

  return settings?.enable_tools ||
    currentModel?.input?.includes("arcana") ||
    false ? (
    <>
      <div className="flex gap-4 w-full items-center">
        <div className="flex-shrink-0 flex items-center gap-2 select-none">
          <p className="text-sm">{t("settings.label_arcana")}</p>
          <HelpCircle
            className="h-[16px] w-[16px] cursor-pointer text-[#009EE0]"
            alt="help"
            onClick={() => openModal("helpArcana")}
          />
        </div>
        <div className="w-full flex gap-1">
          <input
            type="text"
            value={settings?.arcana?.id}
            onChange={handleArcanaChange()}
            placeholder={t("settings.placeholder_arcana_id")}
            className="dark:text-white text-black bg-white dark:bg-bg_secondary_dark p-4 border dark:border-border_dark outline-none rounded-lg shadow-lg dark:shadow-dark w-full max-h-[40px]"
          />
        </div>
      </div>
      {settings.arcana?.id &&
        (settings?.enable_tools ||
          settings.model?.input?.includes("arcana") ||
          false) && (
          <div className="text-yellow-600 text-xs w-full select-none">
            <Trans i18nKey="alert.arcana_usage" />
          </div>
        )}
    </>
  ) : null;
};

export default ArcanaContainer;
