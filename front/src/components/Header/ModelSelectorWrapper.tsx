import { useSelector } from "react-redux";
import { useState, useEffect } from 'react'
import { useGetModelsQuery } from "../../Redux/reducers/appApi";
import ModelSelectorSimple from "./ModelSelectorSimple";
import ModelSelectorExtended from "./ModelSelectorExtended";
import { ExtendedModelInfo, ModelInfo } from "../../types/models";
import { setConversationModelDB, useConversationModelDB } from "../../db/queries"
import { selectCurrentConversationId } from "../../Redux/reducers/conversationsSlice";


export default function ModelSelectorWrapper({modelsList, localState, setLocalState}: {modelsList: ModelInfo, localState: any, setLocalState: any}) {
  /*
  loads the model list and current model and decides which component to render
  */
  const currentModelId = localState.settings.model?.id;

  //render either ModelSelectorSimple or ModelSelectorExtended depending if modelsList contains models with extended==true
  const hasExtendedModels = modelsList?.[0]?.description !== undefined;

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
          <ModelSelectorExtended currentModelId={currentModelId} modelsList={modelsList} onChange={setModel} /> 
        : 
          <ModelSelectorSimple currentModelId={currentModelId} modelsList={modelsList} onChange={setModel} />
      }
    </>
  )
}
