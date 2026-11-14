import { newId } from "../db";

const STORAGE_KEY = "chatai.workspace.deviceId";
let cached: string | null = null;

export function getDeviceId(): string {
  if (cached) return cached;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      cached = stored;
      return stored;
    }
    const created = newId();
    localStorage.setItem(STORAGE_KEY, created);
    cached = created;
    return created;
  } catch {
    cached = cached ?? newId();
    return cached;
  }
}

export const DEVICE_PLANE_KINDS = new Set(["browser", "local", "mcp"]);
