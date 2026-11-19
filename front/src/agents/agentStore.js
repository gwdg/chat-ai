import { useSyncExternalStore } from "react";

import { opencodeDefaults } from "../apis/opencodeAgents";
import { clearAgentDrafts } from "./agentDrafts";
import { clearAgentFormHistory } from "./agentFormHistory";
import { clearAgentPermissionPolicies } from "./agentPermissionPolicies";
import { clearAgentPromptHistories } from "./agentPromptHistory";
import { clearAgentShellHistory } from "./agentShellHistory";

const STORAGE_KEY = "chatai.agents";

// Patches that only track which OpenCode session the agent shows are not a
// modification of the agent itself, so they must not move its timestamp.
const SESSION_ONLY_FIELDS = new Set(["sessionId", "sessionSummaries"]);

const canStore = () => typeof localStorage !== "undefined";

const withTimestamps = (agent, now = Date.now()) => {
  const createdAt =
    Number.isFinite(agent.createdAt) && agent.createdAt > 0
      ? agent.createdAt
      : now;
  return {
    ...agent,
    createdAt,
    updatedAt:
      Number.isFinite(agent.updatedAt) && agent.updatedAt > 0
        ? agent.updatedAt
        : createdAt,
  };
};

const hydrate = (agent) => {
  if (!agent || typeof agent !== "object") return agent;
  return {
    ...withTimestamps(agent),
    // Default-password agents follow front.json; only custom passwords are stored locally.
    password:
      agent.passwordSource === "custom"
        ? agent.password
        : opencodeDefaults().password,
  };
};

const load = () => {
  if (!canStore()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    let backfilled = false;
    const hydrated = parsed.map((agent) => {
      const next = hydrate(agent);
      if (
        next !== agent &&
        (next.createdAt !== agent.createdAt ||
          next.updatedAt !== agent.updatedAt)
      ) {
        backfilled = true;
      }
      return next;
    });
    if (backfilled) {
      // Existing agents predate the timestamps; keep the inferred values so
      // they do not change again on the next load.
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(hydrated));
      } catch {
        // Ignore quota and privacy-mode failures.
      }
    }
    return hydrated;
  } catch {
    return [];
  }
};

let agents = load();
const listeners = new Set();

const persist = () => {
  if (!canStore()) return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        agents.map((agent) => {
          if (agent.passwordSource === "custom") return agent;
          const { password, ...rest } = agent;
          return rest;
        }),
      ),
    );
  } catch {
    // Ignore quota and privacy-mode failures.
  }
};

const emit = () => {
  for (const listener of listeners) listener();
};

// localStorage is shared by every tab, but this module keeps its own copy. Without this
// listener a second tab never learns about an agent that the first tab added: the
// workspace page prunes links for every agent id it does not know, so it would delete
// that agent's `workspace_agents` / `workspace_agent_sessions` rows on its next render.
const onStorage = (event) => {
  // A cleared localStorage reports `key: null`; both mean "re-read the store".
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  agents = load();
  emit();
};

if (typeof window !== "undefined") {
  window.addEventListener("storage", onStorage);
}

export const getAgents = () => agents;

export const getAgent = (id) => agents.find((agent) => agent.id === id);

export const subscribeAgents = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const addAgent = (agent) => {
  agents = [...agents, hydrate(withTimestamps(agent))];
  persist();
  emit();
};

export const updateAgent = (id, patch) => {
  const now = Date.now();
  const changesMetadata = Object.keys(patch ?? {}).some(
    (key) => !SESSION_ONLY_FIELDS.has(key),
  );
  agents = agents.map((agent) =>
    agent.id === id
      ? {
          ...agent,
          ...patch,
          ...(changesMetadata ? { updatedAt: now } : {}),
        }
      : agent,
  );
  persist();
  emit();
};

/** Pin or unpin an agent; it moves between the pinned section and the agent list. */
export const setAgentPinned = (id, pinned) => {
  updateAgent(id, { pinned });
};

export const removeAgent = (id) => {
  agents = agents.filter((agent) => agent.id !== id);
  clearAgentDrafts(id);
  clearAgentFormHistory(id);
  clearAgentPermissionPolicies(id);
  clearAgentPromptHistories(id);
  clearAgentShellHistory(id);
  // Imported lazily: the DB module pulls in the workspace/agent layer. The workspace
  // links go with the agent here rather than waiting for a workspace page to prune
  // them, so removing an agent on any page detaches its sessions immediately.
  void import("../db/agentSessionCache")
    .then(({ removeAgentSessionCacheForAgent }) =>
      removeAgentSessionCacheForAgent(id),
    )
    .catch(() => {});
  void import("../db/workspaceDb")
    .then(({ removeWorkspaceAgentLinks }) => removeWorkspaceAgentLinks(id))
    .catch(() => {});
  persist();
  emit();
};

export function useAgents() {
  return useSyncExternalStore(subscribeAgents, getAgents, getAgents);
}

export function useAgent(id) {
  return useAgents().find((agent) => agent.id === id);
}
