import { useSelector } from "react-redux";
import { useState, useEffect } from 'react'
import { useGetModelsQuery } from "../../Redux/reducers/appApi";
import ModelSelectorSimple from "./ModelSelectorSimple";
import ModelSelectorExtended from "./ModelSelectorExtended";
import { ExtendedModelInfo, ModelInfo } from "../../types/models";
import { setConversationModelDB, useConversationModelDB } from "../../db/queries"
import { selectCurrentConversationId } from "../../Redux/reducers/conversationsSlice";


export default function ModelSelectorWrapper() {
  /*
  loads the model list and current model and decides which component to render
  */
  const { data: modelsList } = useGetModelsQuery(undefined, {refetchOnMountOrArgChange: true, pollingInterval: 30_000});

  const currentConversationId = useSelector(selectCurrentConversationId); // load from redux
  const currentModelId = useConversationModelDB(currentConversationId)?.id; // load from dexieDB
  
  //render either ModelSelectorSimple or ModelSelectorExtended depending if modelsList contains models with extended==true
  const hasExtendedModels = modelsList?.[0]?.extended === true;

  async function setModel(newModel: ModelInfo) {
    console.log(`Setting model to ${newModel.name} (${newModel.id}) for ${currentConversationId}`)
    await setConversationModelDB( // set in dexieDB
      currentConversationId,
      {
        id: newModel.id,
        name: newModel.name,
        input: newModel.input,
        output: newModel.output,
      }
    );
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
