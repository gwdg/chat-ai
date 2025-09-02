
import { memo, useEffect, useState, useRef } from 'react'
import ModelSelectorSimple from "./ModelSelectorSimple";
import ModelSelectorExtended from "./ModelSelectorExtended";
import { useModal } from '../../modals/ModalContext';

function ModelSelectorWrapper({modelsData, localState, setLocalState, inHeader = false}: {modelsData: ModelInfo, localState: any, setLocalState: any, inHeader: boolean}) {
  /*
  render either ModelSelectorSimple or ModelSelectorExtended depending if modelsList contains models with extended==true
  */
  const currentModelId = localState?.settings?.model?.id;
  const selectedModel = modelsData ? modelsData.find(model => model.id === currentModelId) || modelsData[0] || null : null;
  const [initialized, setInitialized] = useState(false);

  const hasExtendedModels = modelsData?.[0]?.description !== undefined;
  const { openModal } = useModal();

  function setModel(newModel: ModelInfo) {
    if (newModel?.status === "offline")
      openModal("serviceOffline");
    setInitialized(false);
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
    if (!currentModelId) return;
    if (!initialized) {
      setInitialized(true);
      return;
    } 
    const foundModel = modelsData.find(
      (model) => model.id === currentModelId
    );
    if (foundModel) setModel(foundModel);
  }, [currentModelId]);

  return (
    <>
      {
        hasExtendedModels ? 
          <ModelSelectorExtended selectedModel={selectedModel} modelsData={modelsData} inHeader={inHeader} onChange={setModel} /> 
        : 
          <ModelSelectorSimple selectedModel={selectedModel} modelsData={modelsData} inHeader={inHeader} onChange={setModel} />
      }
    </>
  )
}


export default memo(ModelSelectorWrapper);