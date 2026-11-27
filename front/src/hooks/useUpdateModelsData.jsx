// useUpdateModelsData.js
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getModelsData } from "../apis/getModelsData";
import { withoutServiceModels } from "../apis/serviceModels";
import { applyBrandModelPolicy } from "../config/brandPolicy";
import { useBrand } from "../config/BrandProvider";
import { useToast } from "./useToast";
import { useModal } from "../modals/ModalContext";
import {
  selectDefaultModel,
  setDefaultModel,
} from "../Redux/reducers/userSettingsReducer";

export function useUpdateModelsData() {
  const [allModels, setAllModels] = useState([]);
  const { notifyError } = useToast();
  const { openModal } = useModal();
  const dispatch = useDispatch();
  const defaultModel = useSelector(selectDefaultModel);
  // A brand may fix the model or drop external ones (config/brandPolicy.js). The
  // hook is reactive so a claim-resolved brand applies as soon as it arrives.
  const { brand } = useBrand();
  const modelsData = useMemo(
    () => applyBrandModelPolicy(allModels, brand),
    [allModels, brand],
  );

  const updateModelsData = useCallback(async () => {
    try {
      const data = await getModelsData();

      if (data instanceof Response) {
        if (data.status === 401) openModal("errorSessionExpired");
        else notifyError(`Failed to fetch models: ${data.status} ${data.statusText}`);
        return;
      }

      if (Array.isArray(data) && data.length === 0) {
        notifyError("No models available or network error");
        return;
      }
      // `saia-fs` is an MCP server that must stay out of the selector. The
      // agent service (`saia-agent`) is a chat model and is kept.
      const chatModels = withoutServiceModels(data);
      if (Array.isArray(chatModels) && chatModels.length === 0) {
        notifyError("No models available or network error");
        return;
      }
      setAllModels(chatModels);
    } catch {
      notifyError("Error fetching models");
    }
  }, []);

  useEffect(() => {
    updateModelsData();
    const interval = setInterval(updateModelsData, 30000);
    return () => clearInterval(interval);
  }, [updateModelsData]);

  /*
  `user_settings.model` is a snapshot of the row the user picked: it carries the
  name (and, once the choice was made after this fix, the externality) of that
  day. `/models` can correct the same id afterwards — a bridge that fronted an
  in-house model used to put "(External)" in the name and set `external: true`,
  and both are gone now — so a default model picked then keeps warning about
  data leaving the institution forever, and seeds every new chat with the old
  label. Refresh the two fields the app reads from that object
  (utils/modelExternality, getDefaultSettings) once the deployment answers.
  Only values the deployment defines are copied: a field it does not send is
  *dropped* from the snapshot instead of being kept, because a stored
  `external: true` (written while another engine labelled the model external)
  would otherwise outrank the name fallback in `isExternalModel` forever. With
  no stored field the single reader falls back to the fresh name, which is where
  a deployment without the field expresses externality.
  */
  useEffect(() => {
    const id = defaultModel?.id;
    if (!id || !Array.isArray(modelsData)) return;
    const fresh = modelsData.find((model) => model.id === id);
    if (!fresh) return;
    const next = { ...defaultModel };
    let changed = false;
    if (fresh.name !== undefined && fresh.name !== defaultModel?.name) {
      next.name = fresh.name;
      changed = true;
    }
    if (fresh.external !== defaultModel?.external) {
      if (fresh.external === undefined) delete next.external;
      else next.external = fresh.external;
      changed = true;
    }
    if (changed) dispatch(setDefaultModel(next));
  }, [defaultModel, modelsData, dispatch]);

  return modelsData;
}
