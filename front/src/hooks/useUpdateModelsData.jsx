// useUpdateModelsData.js
import { useCallback, useEffect, useMemo, useState } from "react";
import { getModelsData } from "../apis/getModelsData";
import { withoutServiceModels } from "../apis/serviceModels";
import { applyBrandModelPolicy } from "../config/brandPolicy";
import { useBrand } from "../config/BrandProvider";
import { useToast } from "./useToast";
import { useModal } from "../modals/ModalContext";

export function useUpdateModelsData() {
  const [allModels, setAllModels] = useState([]);
  const { notifyError } = useToast();
  const { openModal } = useModal();
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

  return modelsData;
}
