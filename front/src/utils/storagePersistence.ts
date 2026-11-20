export type StorageStatus = {
  supported: boolean;
  persisted: boolean;
  usage?: number;
  quota?: number;
};

export type PersistenceRequestReason =
  | "granted"
  | "denied"
  | "unsupported"
  | "error";

export type PersistenceRequestResult = {
  ok: boolean;
  reason: PersistenceRequestReason;
  supported: boolean;
  persisted: boolean;
  error?: unknown;
};

const LOG_PREFIX = "[storage-persistence]";

function log(message: string, details?: unknown) {
  if (details === undefined) {
    console.info(`${LOG_PREFIX} ${message}`);
  } else {
    console.info(`${LOG_PREFIX} ${message}`, details);
  }
}

function warn(message: string, details?: unknown) {
  if (details === undefined) {
    console.warn(`${LOG_PREFIX} ${message}`);
  } else {
    console.warn(`${LOG_PREFIX} ${message}`, details);
  }
}

function environment() {
  const storage = typeof navigator === "undefined" ? undefined : navigator.storage;
  return {
    hasNavigatorStorage: Boolean(storage),
    hasPersist: typeof storage?.persist === "function",
    hasPersisted: typeof storage?.persisted === "function",
    hasEstimate: typeof storage?.estimate === "function",
    isSecureContext:
      typeof window === "undefined" ? undefined : window.isSecureContext,
    origin: typeof window === "undefined" ? undefined : window.location?.origin,
  };
}

export async function requestPersistentStorage(): Promise<PersistenceRequestResult> {
  const storage = typeof navigator === "undefined" ? undefined : navigator.storage;
  const env = environment();
  log("requesting persistent storage", env);

  if (!storage?.persist) {
    warn(
      "navigator.storage.persist() is not available, cannot request persistent storage",
      env,
    );
    return {
      ok: false,
      reason: "unsupported",
      supported: false,
      persisted: false,
    };
  }

  let before: boolean | undefined;
  if (storage.persisted) {
    try {
      before = await storage.persisted();
      log("persisted() before request", { persisted: before });
    } catch (error) {
      warn("persisted() before request failed", error);
    }
  }

  try {
    const granted = await storage.persist();
    log("navigator.storage.persist() resolved", { granted });

    let after: boolean | undefined;
    if (storage.persisted) {
      try {
        after = await storage.persisted();
        log("persisted() after request", { persisted: after });
      } catch (error) {
        warn("persisted() after request failed", error);
      }
    }

    const persisted = granted && after !== false;
    if (!persisted) {
      warn("the browser denied persistent storage", {
        granted,
        persistedBefore: before,
        persistedAfter: after,
        hint: "Chrome grants this without a prompt only to installed apps or sites with enough engagement; Firefox shows a permission prompt.",
      });
      return {
        ok: false,
        reason: "denied",
        supported: true,
        persisted: false,
      };
    }

    log("persistent storage granted", { before, after });
    return { ok: true, reason: "granted", supported: true, persisted: true };
  } catch (error) {
    console.error(`${LOG_PREFIX} navigator.storage.persist() threw`, error);
    return {
      ok: false,
      reason: "error",
      supported: true,
      persisted: false,
      error,
    };
  }
}

export async function getStorageStatus(): Promise<StorageStatus> {
  const storage = typeof navigator === "undefined" ? undefined : navigator.storage;
  if (!storage) {
    warn("navigator.storage is not available", environment());
    return { supported: false, persisted: false };
  }
  try {
    const persisted = storage.persisted ? await storage.persisted() : false;
    const estimate = storage.estimate ? await storage.estimate() : {};
    log("storage status", {
      persisted,
      usage: estimate.usage,
      quota: estimate.quota,
      ...environment(),
    });
    return {
      supported: true,
      persisted,
      usage: estimate.usage,
      quota: estimate.quota,
    };
  } catch (error) {
    warn("failed to read storage status", error);
    return { supported: true, persisted: false };
  }
}
