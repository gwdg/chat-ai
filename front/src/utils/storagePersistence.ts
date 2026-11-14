export type StorageStatus = {
  supported: boolean;
  persisted: boolean;
  usage?: number;
  quota?: number;
};

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function getStorageStatus(): Promise<StorageStatus> {
  const storage = navigator.storage;
  if (!storage) return { supported: false, persisted: false };
  try {
    const persisted = storage.persisted ? await storage.persisted() : false;
    const estimate = storage.estimate ? await storage.estimate() : {};
    return {
      supported: true,
      persisted,
      usage: estimate.usage,
      quota: estimate.quota,
    };
  } catch {
    return { supported: true, persisted: false };
  }
}
