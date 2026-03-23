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
        else if (data.status === 404) {
          console.warn("Models endpoint not configured or not found");
          setModelsData([]);
        } else {
          notifyError(`Failed to fetch models: ${data.status} ${data.statusText}`);
        }
        return;
      }

      if (Array.isArray(data)) {
        if (data.length === 0) {
          console.warn("No models available from API");
        }
        setModelsData(data);
      } else {
        console.error("Unexpected data type:", typeof data);
        setModelsData([]);
      }
    } catch (error) {
      console.error("Error in updateModelsData:", error);
      setModelsData([]);
    }
  }, []);

  useEffect(() => {
    updateModelsData();
    const interval = setInterval(updateModelsData, 30000);
    return () => clearInterval(interval);
  }, [updateModelsData]);

  return modelsData;
}