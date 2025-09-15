// useUpdateModelsData.js
import { useState, useEffect, useCallback } from "react";
import { getModelsData } from "../apis/getModelsData";
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
      setModelsData(data);
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