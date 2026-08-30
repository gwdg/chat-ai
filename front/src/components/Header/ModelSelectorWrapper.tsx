
import { memo, useEffect, useState, useRef } from 'react'
import ModelSelectorSimple from "./ModelSelectorSimple";
import ModelSelectorExtended from "./ModelSelectorExtended";
import { useModal } from '../../modals/ModalContext';
import type { ModelInfo } from '../../types/models';

function ModelSelectorWrapper({modelsData, localState, setLocalState, inHeader = false, listOnly = false, onSelected}: {modelsData: [ModelInfo], localState: any, setLocalState: any, inHeader: boolean, listOnly?: boolean, onSelected?: () => void}) {
  /*
  render either ModelSelectorSimple or ModelSelectorExtended depending if modelsList contains models with extended==true
  */
  const { openModal } = useModal();
  
  const currentModel = localState?.settings?.model || null;
  const currentModelId = localState?.settings?.model?.id || null;
  const currentConversationId = localState?.id;
  //const [selectedModel, setSelectedModel] = useState<ModelInfo | null>(null);
  console.log(currentModelId)
  const selectedModel = (modelsData && currentModelId) ?
    (modelsData.find(model => model.id === currentModelId) || currentModel) : (modelsData ?
    modelsData[0] : (currentModel || null));

  const hasExtendedModels = modelsData?.[0]?.description !== undefined;

  function setModel(newModel: ModelInfo) {
    if (newModel?.id === currentModelId) {
      if (newModel?.status === localState?.settings?.model?.status) return;
    }
    if (newModel?.status === "offline") {
      openModal("serviceOffline");
    }
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
    if(modelsData.length === 0) return;

    const foundModel = modelsData.find(
      (model) => model.id === currentModelId
    );
    if (foundModel){
      setModel(foundModel);
    } else {
      // fallback to first model
      setModel(modelsData[0]);
    }
  }, [currentModelId, modelsData, currentConversationId]);

  return (
    <>
      {
        hasExtendedModels ? 
          <ModelSelectorExtended selectedModel={selectedModel} modelsData={modelsData} inHeader={inHeader} listOnly={listOnly} onSelected={onSelected} onChange={setModel} /> 
        : 
          <ModelSelectorSimple selectedModel={selectedModel} modelsData={modelsData} inHeader={inHeader} listOnly={listOnly} onSelected={onSelected} onChange={setModel} />
      }
    </>
  )
}


export default memo(ModelSelectorWrapper);