import { useSyncExternalStore } from "react";

import { opencodeDefaults } from "../apis/opencodeAgents";

const STORAGE_KEY = "chatai.agents";

const canStore = () => typeof localStorage !== "undefined";

const hydrate = (agent) => {
  if (!agent || typeof agent !== "object") return agent;
  return {
    ...agent,
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
    return Array.isArray(parsed) ? parsed.map(hydrate) : [];
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

export const getAgents = () => agents;

export const getAgent = (id) => agents.find((agent) => agent.id === id);

export const subscribeAgents = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const addAgent = (agent) => {
  agents = [...agents, hydrate(agent)];
  persist();
  emit();
};

export const updateAgent = (id, patch) => {
  agents = agents.map((agent) =>
    agent.id === id ? { ...agent, ...patch } : agent,
  );
  persist();
  emit();
};

export const removeAgent = (id) => {
  agents = agents.filter((agent) => agent.id !== id);
  persist();
  emit();
};

export function useAgents() {
  return useSyncExternalStore(subscribeAgents, getAgents, getAgents);
}

export function useAgent(id) {
  return useAgents().find((agent) => agent.id === id);
}
