import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import BaseModal from "../BaseModal";
import { newId } from "../../db";
import { updateAgent } from "../../agents/agentStore";
import {
  createOpencodeSession,
  getOpencodeInfo,
  opencodeDefaults,
} from "../../apis/opencodeAgents";
import {
  createServiceAgent,
  deleteServiceAgent,
} from "../../apis/agentService";
import { directAgentAccessAllowed } from "../../apis/agentAccess";

// Placeholder project list; the real projects will come from the GWDG backend.
const PROJECT_COUNT = 3;

// The two connection kinds this dialog offers: an agent running on the GWDG HPC
// agentic service, or an OpenCode server the user runs and points at itself.
const CONNECTION_MODES = ["service", "external"];

export default function AddAgentModal({ isOpen, onClose, onCreate, agent }) {
  const { t } = useTranslation();
  const editing = Boolean(agent?.id);
  const defaults = useMemo(() => opencodeDefaults(), []);
  const projects = useMemo(
    () =>
      Array.from({ length: PROJECT_COUNT }, (_, index) => ({
        id: `hpc-project-${index + 1}`,
        name: t("agents.hpc_project", { n: index + 1 }),
      })),
    [t],
  );
  const [name, setName] = useState(agent?.name ?? "");
  const [projectId, setProjectId] = useState(
    agent?.projectId ?? projects[0]?.id ?? "",
  );
  // New agents run on the GWDG HPC agentic service (the default deployment
  // path); an existing agent keeps the mode it was created with so editing never
  // migrates it silently.
  const [mode, setMode] = useState(
    agent ? (agent.serviceAgentId ? "service" : "external") : "service",
  );
  // Direct `opencode serve` connections are a local-only affordance. Outside a
  // locally opened Chat AI every agent must run through the service behind SAIA,
  // so the external server is not offered and an existing direct agent is
  // migrated when it is saved.
  const directAllowed = directAgentAccessAllowed();
  const connectionMode = directAllowed ? mode : "service";
  const serviceMode = connectionMode === "service";
  const [serverUrl, setServerUrl] = useState(
    agent?.serverUrl ?? defaults.serverUrl,
  );
  const [password, setPassword] = useState(
    agent?.password ?? defaults.password,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const project = projects.find((item) => item.id === projectId);

  const submit = async () => {
    if (saving || (serviceMode && !project)) return;
    setSaving(true);
    setError("");
    let next = {
      ...(agent ?? {}),
      id: agent?.id ?? newId(),
      name: name.trim() || project?.name || t("agents.default_name"),
      // `local` is no longer a user choice: an external server is always
      // configured here, while a service agent keeps the flag it had so
      // features that gate on `local !== false` are unaffected.
      local: serviceMode ? agent?.local !== false : true,
      serverUrl: serverUrl.trim(),
      username: agent?.username ?? defaults.username,
      password,
      passwordSource: password === defaults.password ? "config" : "custom",
    };
    let createdServiceId = null;
    let replacedServiceId = null;
    try {
      if (serviceMode) {
        // The service starts an OpenCode backend for this agent; its proxy prefix
        // becomes the agent's server URL and no basic auth is stored.
        let serviceAgentId = agent?.serviceAgentId;
        if (!serviceAgentId) {
          const created = await createServiceAgent({ name: next.name });
          serviceAgentId = created.serviceAgentId;
          createdServiceId = serviceAgentId;
          next.serverUrl = created.serverUrl;
        }
        next = {
          ...next,
          projectId: project.id,
          serviceAgentId,
          serviceManaged: true,
          username: defaults.username,
          password: "",
          passwordSource: "service",
        };
      } else {
        const {
          serviceAgentId: _id,
          serviceManaged: _managed,
          projectId: _project,
          ...direct
        } = next;
        next = direct;
        if (agent?.serviceAgentId) replacedServiceId = agent.serviceAgentId;
      }
      const connectionChanged =
        !editing ||
        next.serverUrl !== agent.serverUrl ||
        next.password !== agent.password;

      let patch = next;
      if (connectionChanged) {
        await getOpencodeInfo(next);
        const session = await createOpencodeSession(
          next,
          `${next.name || project?.name || ""} agent`,
        );
        patch = { ...next, sessionId: session.id };
      }
      if (editing) updateAgent(agent.id, patch);
      else onCreate?.(patch);
      if (replacedServiceId) {
        // Switching a local agent back to a direct connection leaves nothing
        // for the service to own.
        await deleteServiceAgent(replacedServiceId).catch(() => {});
      }
      onClose();
    } catch (reason) {
      if (createdServiceId) {
        // Do not leave a container behind for an agent that was never saved.
        await deleteServiceAgent(createdServiceId).catch(() => {});
      }
      // A 409 is the service's own capacity answer (a backend is full) or a row
      // it will not serve; its message names the reason, so show it verbatim.
      setError(
        t("agents.connect_failed", {
          error: reason instanceof Error ? reason.message : String(reason),
        }),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} titleKey="agents.add_title">
      <div className="flex flex-col gap-3 pb-2 text-sm">
        {directAllowed ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-base-content/70">
              {t("agents.connection_label")}
            </span>
            <div
              role="group"
              aria-label={t("agents.connection_label")}
              className="tabs tabs-box tabs-sm grid min-h-10 grid-cols-2"
            >
              {CONNECTION_MODES.map((option) => {
                const selected = option === connectionMode;
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setMode(option);
                      // The previous attempt's error belongs to the mode that
                      // produced it.
                      setError("");
                    }}
                    className={`tab h-auto min-w-0 whitespace-normal px-2 py-2 text-center text-xs font-medium leading-tight ${
                      selected ? "tab-active text-accent!" : ""
                    }`}
                  >
                    {t(`agents.mode_${option}`)}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-[11px] leading-relaxed text-base-content/60">
            {t("agents.service_forced_hint")}
          </p>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-base-content/70">
            {t("agents.name_label")}
          </span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("agents.name_placeholder")}
            className="input input-bordered w-full"
          />
        </label>
        {serviceMode && (
          <>
            <div className="flex flex-col gap-1">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-base-content/70">
                  {t("agents.hpc_project_label")}
                </span>
                <select
                  value={projectId}
                  onChange={(event) => setProjectId(event.target.value)}
                  className="select select-bordered w-full"
                >
                  {projects.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-[11px] leading-relaxed text-base-content/50">
                {t("agents.hpc_project_hint")}
              </p>
            </div>
            <p className="text-[11px] leading-relaxed text-base-content/50">
              {t("agents.service_hint")}
            </p>
          </>
        )}
        {!serviceMode && (
          <>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-base-content/70">
                {t("agents.server_url_label")}
              </span>
              <input
                value={serverUrl}
                onChange={(event) => setServerUrl(event.target.value)}
                placeholder="http://127.0.0.1:9000"
                className="input input-bordered w-full"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-base-content/70">
                {t("agents.server_password_label")}
              </span>
              <input
                type="password"
                autoComplete="off"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="input input-bordered w-full"
              />
            </label>
            <p className="text-[11px] leading-relaxed text-base-content/50">
              {t("agents.connect_hint")}
            </p>
          </>
        )}
        {error && <p className="text-xs text-error">{error}</p>}
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="btn btn-accent"
            onClick={submit}
            disabled={saving || (serviceMode && !project)}
          >
            {saving
              ? t("agents.connecting")
              : editing
                ? t("common.save")
                : t("agents.add")}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
