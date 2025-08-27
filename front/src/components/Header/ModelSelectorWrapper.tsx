import { useSelector } from "react-redux";
import { useState, useEffect, memo } from 'react'
import { useGetModelsQuery } from "../../Redux/reducers/appApi";
import ModelSelectorSimple from "./ModelSelectorSimple";
import ModelSelectorExtended from "./ModelSelectorExtended";
import { ExtendedModelInfo, ModelInfo } from "../../types/models";
import { setConversationModelDB, useConversationModelDB } from "../../db/queries"
import { selectCurrentConversationId } from "../../Redux/reducers/conversationsSlice";


function ModelSelectorWrapper({modelsData, localState, setLocalState}: {modelsData: ModelInfo, localState: any, setLocalState: any}) {
  /*
  render either ModelSelectorSimple or ModelSelectorExtended depending if modelsList contains models with extended==true
  */
  const currentModelId = localState.settings.model.id;
  //
  const hasExtendedModels = modelsData?.[0]?.description !== undefined;

  function setModel(newModel: ModelInfo) {
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
          <ModelSelectorExtended currentModelId={currentModelId} modelsList={modelsData} onChange={setModel} /> 
        : 
          <ModelSelectorSimple currentModelId={currentModelId} modelsList={modelsData} onChange={setModel} />
      }
    </>
  )
}


export default memo(ModelSelectorWrapper);