
import { memo, useEffect, useState } from 'react'
import ModelSelectorSimple from "./ModelSelectorSimple";
import ModelSelectorExtended from "./ModelSelectorExtended";
import ModelSelectorIcon from "./ModelSelectorIcon";
import { useModal } from '../../modals/ModalContext';
import type { ModelInfo } from '../../types/models';

interface ModelSelectorWrapperProps {
  modelsData: ModelInfo[];
  localState: any;
  setLocalState: any;
  inHeader?: boolean;
  iconMode?: boolean;
}

function ModelSelectorWrapper({modelsData, localState, setLocalState, inHeader = false, iconMode = false}: ModelSelectorWrapperProps) {
  /*
  render either ModelSelectorSimple or ModelSelectorExtended depending if modelsList contains models with extended==true
  */
  const { openModal } = useModal();

  const currentModelId = localState?.settings?.model?.id;
  const [selectedModel, setSelectedModel] = useState<ModelInfo | null>(null);

  // Ensure modelsData is always an array
  const safeModelsData = Array.isArray(modelsData) ? modelsData : [];
  const hasExtendedModels = safeModelsData.length > 0 && 'description' in safeModelsData[0];

  function setModel(newModel: ModelInfo) {
    if (newModel?.status === "offline") {
      openModal("serviceOffline");
    }
    setSelectedModel(newModel);
    setLocalState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        model: newModel,
      },
    }));
  }

  // currentModelId has changed indirectly
  useEffect(() => {
    if(!currentModelId) return;
    if(safeModelsData.length === 0) return;

    const foundModel = safeModelsData.find(
      (model) => model.id === currentModelId
    );
    if (foundModel){
      setModel(foundModel);
    } else {
      // fallback to first model
      setModel(safeModelsData[0]);
    }
  }, [currentModelId, safeModelsData]);

  return (
    <>
      {
        iconMode ? (
          <ModelSelectorIcon selectedModel={selectedModel} modelsData={modelsData} inHeader={inHeader} onChange={setModel} />
        ) : hasExtendedModels ?
          <ModelSelectorExtended selectedModel={selectedModel as any} modelsData={modelsData as any} onChange={setModel as any} />
        :
          <ModelSelectorSimple selectedModel={selectedModel} modelsData={modelsData as any} inHeader={inHeader} onChange={setModel} />
      }
    </>
  )
}


export default memo(ModelSelectorWrapper);