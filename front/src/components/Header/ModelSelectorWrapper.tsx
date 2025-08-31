
import { memo, useEffect } from 'react'
import ModelSelectorSimple from "./ModelSelectorSimple";
import ModelSelectorExtended from "./ModelSelectorExtended";
import { useModal } from '../../modals/ModalContext';

function ModelSelectorWrapper({modelsData, localState, setLocalState, inHeader = false}: {modelsData: ModelInfo, localState: any, setLocalState: any, inHeader: boolean}) {
  /*
  render either ModelSelectorSimple or ModelSelectorExtended depending if modelsList contains models with extended==true
  */
  const currentModelId = localState?.settings?.model?.id;
  const hasExtendedModels = modelsData?.[0]?.description !== undefined;
  const { openModal } = useModal();

  function setModel(newModel: ModelInfo) {
    if (newModel?.status === "offline")
      openModal("serviceOffline");
    setLocalState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        model: newModel,
      },
    }));
  }

  return (
    <>
      {
        hasExtendedModels ? 
          <ModelSelectorExtended currentModelId={currentModelId} modelsData={modelsData} inHeader={inHeader} onChange={setModel} /> 
        : 
          <ModelSelectorSimple currentModelId={currentModelId} modelsData={modelsData} inHeader={inHeader} onChange={setModel} />
      }
    </>
  )
}


export default memo(ModelSelectorWrapper);