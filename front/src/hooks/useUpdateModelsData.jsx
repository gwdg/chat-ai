// useUpdateModelsData.js
import { useState, useEffect, useCallback } from "react";
import { getModelsData } from "../apis/getModelsData";
import { withoutServiceModels } from "../apis/serviceModels";
import { useToast } from "./useToast";
import { useModal } from "../modals/ModalContext";

export function useUpdateModelsData() {
  const [modelsData, setModelsData] = useState([]);
  const { notifyError } = useToast();
  const { openModal } = useModal();

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
      setModelsData(chatModels);
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