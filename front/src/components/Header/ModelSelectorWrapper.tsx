
import { memo, useEffect } from 'react'
import { useSelector } from 'react-redux';
import ModelSelectorSimple from "./ModelSelectorSimple";
import ModelSelectorExtended from "./ModelSelectorExtended";
import { useModal } from '../../modals/ModalContext';
import { selectUserSettings } from '../../Redux/reducers/userSettingsReducer';
import { getDefaultChatAIModel } from '../../utils/conversationUtils';
import type { ModelInfo } from '../../types/models';

function ModelSelectorWrapper({modelsData, localState, setLocalState, inHeader = false, listOnly = false, onSelected, selectedModel: selectedModelOverride, onChange}: {modelsData: [ModelInfo], localState: any, setLocalState: any, inHeader: boolean, listOnly?: boolean, onSelected?: () => void, selectedModel?: ModelInfo | null, onChange?: (model: ModelInfo) => void}) {
  /*
  Render ModelSelectorExtended when the models carry SAIA metadata (detected via
  `description` on the first model), otherwise the plain OpenAI-compatible
  ModelSelectorSimple.
  */
  const { openModal } = useModal();
  const userSettings = useSelector(selectUserSettings);

  // When called with an explicit selectedModel/onChange (e.g. the settings
  // panel), drive the selector directly. Otherwise derive from localState.
  const controlled = onChange !== undefined && selectedModelOverride !== undefined;

  const currentModel = localState?.settings?.model || null;
  const currentModelId = localState?.settings?.model?.id || null;
  const currentConversationId = localState?.id;
  const selectedModel = controlled
    ? selectedModelOverride
    : (modelsData && currentModelId)
      ? (modelsData.find(model => model.id === currentModelId) || currentModel)
      : (modelsData ? modelsData[0] : (currentModel || null));

  const hasExtendedModels = modelsData?.[0]?.description !== undefined;

  function setModel(newModel: ModelInfo) {
    if (newModel?.id === currentModelId) {
      const currentModel = localState?.settings?.model;
      const sameCapabilities =
        JSON.stringify(newModel?.input) === JSON.stringify(currentModel?.input) &&
        JSON.stringify(newModel?.output) === JSON.stringify(currentModel?.output);
      if (
        newModel?.status === currentModel?.status &&
        sameCapabilities
      ) return;
    }
    if (newModel?.status === "offline") {
      openModal("serviceOffline");
    }
    if (controlled) {
      onChange?.(newModel);
      return;
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
      // The imported or stored model is unavailable. Fall back to the user's
      // configured default model, and only then to the first available model.
      const defaultModelId = getDefaultChatAIModel(userSettings);
      const fallbackModel =
        modelsData.find((model) => model.id === defaultModelId) ||
        modelsData[0];
      setModel(fallbackModel);
    }
  }, [currentModelId, modelsData, currentConversationId, userSettings]);

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