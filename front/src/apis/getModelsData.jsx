// Gets available models data from the server
export async function getModelsData() {
  try {
    const response = await fetch(import.meta.env.VITE_MODELS_ENDPOINT);
    
    if (!response.ok) {
      console.error(`Models endpoint returned status: ${response.status} ${response.statusText}`);
      return response; // Return the Response object so hook can handle different status codes
    }
    
    const responseData = await response.json();
    console.log("Models API response type:", typeof responseData);
    console.log("Models API response:", JSON.stringify(responseData, null, 2));
    
    let modelsData;
    
    if (Array.isArray(responseData)) {
      modelsData = responseData;
      console.log(`Found ${modelsData.length} models directly in array`);
    } else if (responseData != null && typeof responseData === 'object') {
      if (responseData.data && Array.isArray(responseData.data)) {
        modelsData = responseData.data;
        console.log(`Found ${modelsData.length} models in data property`);
      } else if (responseData.models && Array.isArray(responseData.models)) {
        modelsData = responseData.models;
        console.log(`Found ${modelsData.length} models in models property`);
      } else if (responseData.items && Array.isArray(responseData.items)) {
        modelsData = responseData.items;
        console.log(`Found ${modelsData.length} models in items property`);
      } else if (Object.keys(responseData).length === 0) {
        console.warn("Models API returned an empty object - endpoint may not be configured");
        return [];
      } else {
        // Check if it's an error response with 'detail' field (FastAPI error format)
        if (responseData.detail && typeof responseData.detail === 'string') {
          console.warn("Models API returned error:", responseData.detail);
          // Return an empty array - this is not a critical error
          return [];
        }
        console.error("Invalid models data format:", responseData);
        console.error("Response keys:", Object.keys(responseData));
        return [];
      }
    } else {
      console.error("Unexpected response type:", typeof responseData);
      return [];
    }
    
    const enrichedModelsData = modelsData.map((model) => ({
      ...model,
      name: model.name || model.id,
    }));
    
    return enrichedModelsData;
  } catch (error) {
    console.error("Failed to load models data:", error.message, error);
    return [];
  }
}
