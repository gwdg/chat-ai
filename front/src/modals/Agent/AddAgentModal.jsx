import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import BaseModal from "../BaseModal";
import { newId } from "../../db";
import {
  createOpencodeSession,
  getOpencodeInfo,
  opencodeDefaults,
} from "../../apis/opencodeAgents";

// Placeholder project list; the real projects will come from the GWDG backend.
const PROJECT_COUNT = 3;

export default function AddAgentModal({ isOpen, onClose, onCreate }) {
  const { t } = useTranslation();
  const defaults = useMemo(() => opencodeDefaults(), []);
  const projects = useMemo(
    () =>
      Array.from({ length: PROJECT_COUNT }, (_, index) => ({
        id: `hpc-project-${index + 1}`,
        name: t("agents.hpc_project", { n: index + 1 }),
      })),
    [t],
  );
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [serverUrl, setServerUrl] = useState(defaults.serverUrl);
  const [password, setPassword] = useState(defaults.password);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const project = projects.find((item) => item.id === projectId);

  const submit = async () => {
    if (!project || saving) return;
    setSaving(true);
    setError("");
    const agent = {
      id: newId(),
      projectId: project.id,
      name: project.name,
      serverUrl: serverUrl.trim(),
      username: defaults.username,
      password,
    };
    try {
      await getOpencodeInfo(agent);
      const session = await createOpencodeSession(agent, `${project.name} agent`);
      onCreate?.({ ...agent, sessionId: session.id });
      onClose();
    } catch (reason) {
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
        {error && <p className="text-xs text-error">{error}</p>}
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="btn btn-accent"
            onClick={submit}
            disabled={!project || saving}
          >
            {saving ? t("agents.connecting") : t("agents.add")}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
