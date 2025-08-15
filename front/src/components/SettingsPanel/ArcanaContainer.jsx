import { useState } from "react";
import { Trans } from "react-i18next";
import icon_help from "../../assets/icons/help.svg";
import { useModal } from "../../modals/ModalContext";

// Component for Arcana authentication inputs
const ArcanaContainer = ({ localState, setLocalState }) => {
  const { openModal } = useModal();
  const settings = localState.settings;
  const handleArcanaChange = () => (e) => {
    console.log({
      ...localState,
      settings: {
        arcana: {
          ...localState.settings.arcana,
          id: e.target.value,
        },
      },
    })
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

  // const currentModel = useMemo(
  //   () => modelList?.find((m) => m.name === modelSettings["model-name"]),
  //   [modelList, modelSettings]
  // );
  const currentModel = settings.model
  return  (settings?.enable_tools || (currentModel?.input?.includes("arcana") || false)) ? (
    <>
      <div className="flex gap-4 w-full items-center">
        <div className="flex-shrink-0 flex items-center gap-2 select-none">
          <p className="text-sm">Arcana</p>
          <img
            src={icon_help}
            alt="help"
            className="h-[16px] w-[16px] cursor-pointer"
            onClick={() => openModal("helpArcana")}
          />
        </div>
        <div className="w-full flex gap-1">
          <input
            type="text"
            value={settings?.arcana.id}
            onChange={handleArcanaChange()}
            placeholder="id"
            className="dark:text-white text-black bg-white dark:bg-bg_secondary_dark p-4 border dark:border-border_dark outline-none rounded-lg shadow-lg dark:shadow-dark w-full max-h-[40px]"
          />

          {/* <input
            type="text"
            value={localState.arcana.key}
            onChange={handleArcanaChange("key")}
            placeholder="key"
            className="dark:text-white text-black bg-white dark:bg-bg_secondary_dark p-4 border outline-none rounded-2xl shadow-lg dark:shadow-dark w-full max-h-[47px] dark:border-border_dark"
          /> */}
        </div>
        {/* Arcana warning*/}
      </div>
      {settings.arcana?.id && (settings?.enable_tools || (settings.model?.input?.includes("arcana") || false)) && (
        <div className="text-yellow-600 text-xs w-full select-none">
          <Trans i18nKey="description.warning_arcana" />
        </div>
      )}
    </>
  ) : null;
};

export default ArcanaContainer;
