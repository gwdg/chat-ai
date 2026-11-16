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
  hasAgentService,
} from "../../apis/agentService";
import { directAgentAccessAllowed } from "../../apis/agentAccess";

// Placeholder project list; the real projects will come from the GWDG backend.
const PROJECT_COUNT = 3;

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
  const [local, setLocal] = useState(agent?.local !== false);
  const serviceAvailable = hasAgentService();
  // A new agent uses the service when one is configured; an existing agent
  // keeps the mode it was created with so editing never migrates it silently.
  const [useService, setUseService] = useState(
    agent?.serviceAgentId ? true : !agent && serviceAvailable,
  );
  // Direct `opencode serve` connections are a local-only affordance. Outside a
  // locally opened Chat AI every agent must run through the service behind SAIA,
  // so the direct mode is not offered and an existing direct agent is migrated
  // when it is saved.
  const directAllowed = directAgentAccessAllowed();
  const serviceMode = useService || !directAllowed;
  const serviceMissing =
    serviceMode && !serviceAvailable && !agent?.serviceAgentId;
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
    if (!project || saving || serviceMissing) return;
    setSaving(true);
    setError("");
    const effectiveServerUrl = local
      ? serverUrl.trim()
      : defaults.serverUrl;
    const effectivePassword = local ? password : defaults.password;
    let next = {
      ...(agent ?? {}),
      id: agent?.id ?? newId(),
      projectId: project.id,
      name: name.trim() || project.name,
      local,
      serverUrl: effectiveServerUrl,
      username: agent?.username ?? defaults.username,
      password: effectivePassword,
      passwordSource:
        effectivePassword === defaults.password ? "config" : "custom",
    };
    let createdServiceId = null;
    let replacedServiceId = null;
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
        serviceAgentId,
        serviceManaged: true,
        username: defaults.username,
        password: "",
        passwordSource: "service",
      };
    } else {
      const { serviceAgentId: _id, serviceManaged: _managed, ...direct } =
        next;
      next = direct;
      if (agent?.serviceAgentId) replacedServiceId = agent.serviceAgentId;
    }
    const connectionChanged =
      !editing ||
      next.serverUrl !== agent.serverUrl ||
      next.password !== agent.password;
    try {
      let patch = next;
      if (connectionChanged) {
        await getOpencodeInfo(next);
        const session = await createOpencodeSession(
          next,
          `${next.name || project.name} agent`,
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
        <p className="text-xs text-base-content/70">{t("agents.add_hint")}</p>
        {directAllowed && (serviceAvailable || agent?.serviceAgentId) && (
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              className="toggle toggle-sm"
              checked={useService}
              onChange={(event) => setUseService(event.target.checked)}
            />
            {t("agents.use_service")}
          </label>
        )}
        {!serviceMode && (
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              className="toggle toggle-sm"
              checked={local}
              onChange={(event) => setLocal(event.target.checked)}
            />
            {t("agents.local")}
          </label>
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
          <p className="text-[11px] leading-relaxed text-base-content/50">
            {t("agents.service_hint")}
          </p>
        )}
        {!directAllowed && (
          <p
            className={
              serviceMissing
                ? "text-[11px] leading-relaxed text-error"
                : "text-[11px] leading-relaxed text-base-content/60"
            }
          >
            {serviceMissing
              ? t("agents.service_required")
              : t("agents.service_forced_hint")}
          </p>
        )}
        {!serviceMode && !local && (
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
        )}
        {!serviceMode && local && (
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
            disabled={!project || saving || serviceMissing}
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
