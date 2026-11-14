const STORAGE_PREFIX = "chatai.agent-permission-policies";
const MAX_POLICIES = 50;

const storageKey = (agentId) => `${STORAGE_PREFIX}:${agentId}`;

const canStore = () => typeof localStorage !== "undefined";

const normalizePolicy = (policy) => {
  const action = String(policy?.action ?? "").trim();
  const decision = policy?.decision;
  if (!action || !["once", "always", "reject"].includes(decision)) {
    return null;
  }
  return {
    id: policy.id ?? `${action}:${decision}`,
    action,
    decision,
  };
};

const globMatches = (pattern, value) => {
  const escaped = pattern
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${escaped}$`, "i").test(value);
};

export function matchPermissionPolicy(policies, permission) {
  const action = String(permission?.action ?? "");
  return (policies ?? []).find((policy) =>
    globMatches(policy.action, action),
  );
}

export function loadAgentPermissionPolicies(agentId) {
  if (!canStore() || !agentId) return [];
  try {
    const raw = localStorage.getItem(storageKey(agentId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizePolicy).filter(Boolean);
  } catch {
    return [];
  }
}

export function saveAgentPermissionPolicies(agentId, policies) {
  if (!canStore() || !agentId) return;
  try {
    const next = policies
      .map(normalizePolicy)
      .filter(Boolean)
      .slice(-MAX_POLICIES);
    localStorage.setItem(storageKey(agentId), JSON.stringify(next));
  } catch {}
}

export function clearAgentPermissionPolicies(agentId) {
  if (!canStore() || !agentId) return;
  try {
    localStorage.removeItem(storageKey(agentId));
  } catch {}
}
