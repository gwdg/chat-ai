import { useState } from "react";
import help from "../../../assets/icon_help.svg";
import { useModal } from "../../../modals/ModalContext";

// Component for Arcana authentication inputs
const ArcanaContainer = ({ localState, setLocalState }) => {
  const { openModal } = useModal();
  // Generic handler for both id and key changes
  const handleArcanaChange = (field) => (e) => {
    setLocalState((prev) => ({
      ...prev,
      arcana: {
        ...prev.arcana,
        [field]: e.target.value,
      },
    }));
  };

  // const currentModel = useMemo(
  //   () => modelList?.find((m) => m.name === modelSettings["model-name"]),
  //   [modelList, modelSettings]
  // );
  const currentModel = localState.settings.model
  return  (localState.settings.useGWDGTools || (currentModel?.input?.includes("arcana") || false)) ? (
    <div className="flex gap-4 w-full items-center">
      <div className="flex-shrink-0 flex items-center gap-2 select-none">
        <p className="text-sm">Arcana</p>
        <img
          src={help}
          alt="help"
          className="h-[16px] w-[16px] cursor-pointer"
          onClick={() => openModal("helpArcana")}
        />
      </div>
      <div className="w-full flex gap-1">
        <input
          type="text"
          value={localState.arcana.id}
          onChange={handleArcanaChange("id")}
          placeholder="id"
          className="dark:text-white text-black bg-white dark:bg-bg_secondary_dark p-4 border dark:border-border_dark outline-none rounded-2xl shadow-lg dark:shadow-dark w-full max-h-[47px]"
        />

        {/* <input
          type="text"
          value={localState.arcana.key}
          onChange={handleArcanaChange("key")}
          placeholder="key"
          className="dark:text-white text-black bg-white dark:bg-bg_secondary_dark p-4 border outline-none rounded-2xl shadow-lg dark:shadow-dark w-full max-h-[47px] dark:border-border_dark"
        /> */}
      </div>
    </div>
  ) : null;
};

export default ArcanaContainer;
