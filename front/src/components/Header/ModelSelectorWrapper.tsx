import { useGetModelsQuery } from "../../Redux/reducers/appApi";

import ModelSelectorSimple from "./ModelSelectorSimple";
import ModelSelectorExtended from "./ModelSelectorExtended";
import { ExtendedModelInfo } from "../../types/models";

export default function ModelSelectorWrapper({ localState, setLocalState}) {
    const { data: modelsList, isLoading, isFetching,} = useGetModelsQuery(undefined, {pollingInterval: 30_000, refetchOnMountOrArgChange: true});


  //render either ModelSelectorSimple or ModelSelectorExtended depending if modelsList contains models with extended==true
  const hasExtendedModels = modelsList?.[0]?.extended === true;

  function setModel(newModel) {
    console.log("On change in wrapper")
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
      {hasExtendedModels ? <ModelSelectorExtended modelsList={modelsList} onChange={setModel} /> : <ModelSelectorSimple modelsList={modelsList} />}
    </>
  )
}
