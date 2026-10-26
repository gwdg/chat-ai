// components/settings/ArcanaContainer.jsx
import { Trans, useTranslation } from "react-i18next";
import { CircleHelp } from "lucide-react";
import { useModal } from "../../modals/ModalContext";

const ArcanaContainer = ({ localState, setLocalState }) => {
  const { t } = useTranslation();
  const { openModal } = useModal();
  const settings = localState.settings;
  const modelName = settings?.model?.name;
  const isExternalModel =
    typeof modelName === "string" &&
    modelName.toLowerCase().includes("external");

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

  return (settings?.enable_tools && !isExternalModel) ||
    false ? (
    <>
      <div className="flex gap-4 w-full items-center">
        <div className="flex-shrink-0 flex items-center gap-2 select-none">
          <p className="text-sm">{t("settings.label_arcana")}</p>
          <CircleHelp
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
            className="input w-full"
          />
        </div>
      </div>
      {settings.arcana?.id &&
        (settings?.enable_tools ||
          settings.model?.input?.includes("arcana") ||
          false) && (
          <div className="text-warning text-xs w-full select-none space-y-1">
            <div>
              <Trans i18nKey="alert.arcana_usage" />
            </div>
            <div>
              {t("alert.arcana_create_collection_prefix") + " "}
              <a
                href="https://chat-ai.academiccloud.de/arcanas/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold"
              >
                {t("alert.arcana_create_collection_link")}
              </a>
              .
            </div>
          </div>
        )}
    </>
  ) : null;
};

export default ArcanaContainer;
