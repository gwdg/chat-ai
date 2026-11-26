
import { memo, useEffect } from 'react'
import { useSelector } from 'react-redux';
import { Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ModelSelectorSimple from "./ModelSelectorSimple";
import ModelSelectorExtended from "./ModelSelectorExtended";
import { useModal } from '../../modals/ModalContext';
import { selectUserSettings } from '../../Redux/reducers/userSettingsReducer';
import { getDefaultChatAIModel } from '../../utils/conversationUtils';
import { isBrandLocked, isBrandUiVisible } from '../../config/brandPolicy';
import E2eeLock from '../Others/E2eeLock';
import type { ModelInfo } from '../../types/models';

function ModelSelectorWrapper({modelsData, localState, setLocalState, inHeader = false, listOnly = false, onSelected, selectedModel: selectedModelOverride, onChange}: {modelsData: [ModelInfo], localState: any, setLocalState: any, inHeader: boolean, listOnly?: boolean, onSelected?: () => void, selectedModel?: ModelInfo | null, onChange?: (model: ModelInfo) => void}) {
  /*
  Render ModelSelectorExtended when the models carry SAIA metadata (detected via
  `description` on the first model), otherwise the plain OpenAI-compatible
  ModelSelectorSimple.
  */
  const { openModal } = useModal();
  const { t } = useTranslation();
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
        newModel?.name === currentModel?.name &&
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

  // A brand may leave the model control out entirely and set the model through
  // the deployment defaults (GAIA). Nothing is left to show or choose.
  if (!isBrandUiVisible("model_selector")) return null;

  // A brand may pin the model (config/brandPolicy.js#isBrandLocked). The chip
  // still names it, so the user knows what answers, but there is no list and no
  // control: the model is the institution's choice.
  if (isBrandLocked("model")) {
    return (
      <div
        className="flex min-w-0 select-none items-center gap-1.5 rounded-xl border border-base-300 bg-base-100 px-2 py-1 text-sm text-base-content/80"
        title={t("model_selector.locked")}
        data-guide="model-locked"
      >
        <Lock
          size={13}
          className="flex-shrink-0 text-base-content/60"
          aria-hidden="true"
        />
        <span className="truncate font-medium text-base-content">
          {selectedModel?.name || selectedModel?.id}
        </span>
        <E2eeLock modelId={selectedModel?.id} size={13} />
      </div>
    );
  }

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