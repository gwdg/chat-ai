import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bot, Check, Cloud, Plus, Server } from "lucide-react";

import { addAgent, useAgents } from "../../agents/agentStore";
import {
  attachWorkspaceAgent,
  detachWorkspaceAgent,
  removeAgentFilesSource,
  useWorkspaceAgents,
} from "../../db/workspaceDb";
import { useModal } from "../../modals/ModalContext";
import { useToast } from "../../hooks/useToast";

type AgentKind = "browser" | "opencode" | "remote";
type ConnectionKind = Exclude<AgentKind, "browser">;

const agentKind = (agent): ConnectionKind =>
  agent.serviceAgentId ? "remote" : "opencode";

function AgentOption({
  dataGuide,
  icon: Icon,
  title,
  description,
  selected,
  onClick,
}: {
  dataGuide: string;
  icon: typeof Bot;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  const stateClass = selected
    ? "border-accent/60 bg-accent/5"
    : "border-base-300 hover:border-accent/40 hover:bg-base-200/60";

  return (
    <button
      type="button"
      data-guide={dataGuide}
      aria-pressed={selected}
      onClick={onClick}
      className={`flex w-full items-start gap-2 rounded-lg border px-2 py-2 text-left transition ${stateClass}`}
    >
      <Icon
        size={17}
        className={`mt-0.5 shrink-0 ${
          selected ? "text-accent" : "text-base-content/55"
        }`}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold leading-tight text-base-content">
          {title}
        </span>
        <span className="mt-0.5 line-clamp-2 block text-[11px] leading-snug text-base-content/55">
          {description}
        </span>
      </span>
      <Check
        size={15}
        className={`mt-0.5 shrink-0 ${
          selected ? "text-accent" : "opacity-0"
        }`}
      />
    </button>
  );
}

export default function WorkspaceAgentPanel({
  workspaceId,
  framed = true,
}: {
  workspaceId?: string;
  framed?: boolean;
}) {
  const { t } = useTranslation();
  const { openModal } = useModal();
  const { notifyError } = useToast();
  const agents = useAgents();
  const links = useWorkspaceAgents(workspaceId);
  const [pickerKind, setPickerKind] = useState<ConnectionKind | null>(null);

  const attachedAgents = useMemo(() => {
    const byId = new Map(agents.map((agent) => [agent.id, agent]));
    return links
      .map((link) => byId.get(link.agentId))
      .filter((agent): agent is NonNullable<typeof agent> => Boolean(agent));
  }, [agents, links]);

  // A workspace uses one agent choice. Existing links win, so a workspace that
  // already had several agents keeps showing the one it would actually use.
  const attachedKind = useMemo<AgentKind>(() => {
    if (attachedAgents.some((agent) => agent.serviceAgentId)) return "remote";
    if (attachedAgents.some((agent) => agent.serverUrl)) return "opencode";
    return "browser";
  }, [attachedAgents]);

  const selectedKind = pickerKind ?? attachedKind;
  const attachedIds = useMemo(
    () => new Set(links.map((link) => link.agentId)),
    [links],
  );

  const agentsOfKind = useMemo(
    () =>
      pickerKind
        ? agents.filter((agent) => agentKind(agent) === pickerKind)
        : [],
    [agents, pickerKind],
  );

  const fail = (reason: unknown) =>
    notifyError(reason instanceof Error ? reason.message : String(reason));

  const detachAll = async () => {
    if (!workspaceId) return;
    for (const link of links) {
      await detachWorkspaceAgent(workspaceId, link.agentId);
      await removeAgentFilesSource(workspaceId, link.agentId);
    }
  };

  const useInBrowser = async () => {
    setPickerKind(null);
    try {
      await detachAll();
    } catch (reason) {
      fail(reason);
    }
  };

  const useAgent = async (agent) => {
    if (!workspaceId) return;
    try {
      for (const link of links) {
        if (link.agentId === agent.id) continue;
        await detachWorkspaceAgent(workspaceId, link.agentId);
        await removeAgentFilesSource(workspaceId, link.agentId);
      }
      await attachWorkspaceAgent(workspaceId, agent.id);
      setPickerKind(null);
    } catch (reason) {
      fail(reason);
    }
  };

  const chooseOption = (kind: AgentKind) => {
    if (kind === "browser") {
      void useInBrowser();
      return;
    }
    setPickerKind(kind);
  };

  const addNewAgent = () => {
    if (!pickerKind) return;
    openModal("agentAdd", {
      initialMode: pickerKind === "remote" ? "service" : "external",
      onCreate: (agent) => {
        addAgent(agent);
        void useAgent(agent);
      },
    });
  };

  return (
    <section
      className={
        framed
          ? "rounded-xl border border-base-300 bg-base-100 p-1.5"
          : undefined
      }
      data-guide="workspace-agent"
    >
      {framed && (
        <div className="flex items-center justify-between px-1 py-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-base-content/45">
            {t("workspace.agent.title")}
          </span>
        </div>
      )}

      <div className="mt-1 flex flex-col gap-1.5">
        <AgentOption
          dataGuide="workspace-agent-browser"
          icon={Bot}
          title={t("workspace.agent.browser_title")}
          description={t("workspace.agent.browser_description")}
          selected={selectedKind === "browser"}
          onClick={() => chooseOption("browser")}
        />
        <AgentOption
          dataGuide="workspace-agent-opencode"
          icon={Server}
          title={t("workspace.agent.opencode_title")}
          description={t("workspace.agent.opencode_description")}
          selected={selectedKind === "opencode"}
          onClick={() => chooseOption("opencode")}
        />
        <AgentOption
          dataGuide="workspace-agent-remote"
          icon={Cloud}
          title={t("workspace.agent.remote_title")}
          description={t("workspace.agent.remote_description")}
          selected={selectedKind === "remote"}
          onClick={() => chooseOption("remote")}
        />
      </div>

      {pickerKind && (
        <div className="mt-1.5 border-t border-base-300 pt-1.5">
          <div className="flex items-center justify-between px-1 pb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-base-content/45">
              {t("workspace.agent.choose_existing")}
            </span>
            <button
              type="button"
              onClick={() => setPickerKind(null)}
              className="rounded px-1 text-[10px] font-semibold text-base-content/50 transition hover:text-base-content"
            >
              {t("workspace.agent.back")}
            </button>
          </div>
          <div className="flex flex-col gap-1">
            {agentsOfKind.length === 0 ? (
              <p className="px-1 py-1 text-[10px] text-base-content/50">
                {t("workspace.agent.no_agents")}
              </p>
            ) : (
              agentsOfKind.map((agent) => {
                const attached = attachedIds.has(agent.id);
                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => void useAgent(agent)}
                    className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition ${
                      attached
                        ? "border-accent/60 bg-accent/5"
                        : "border-base-300 hover:bg-base-200/60"
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-base-content">
                        {agent.name}
                      </span>
                      <span className="block truncate text-[10px] text-base-content/50">
                        {attached
                          ? t("workspace.agent.in_use")
                          : t("workspace.agent.available")}
                      </span>
                    </span>
                    {attached && (
                      <Check size={14} className="shrink-0 text-accent" />
                    )}
                  </button>
                );
              })
            )}
            <button
              type="button"
              data-guide="workspace-agent-add"
              onClick={addNewAgent}
              className="flex w-full items-center gap-2 rounded-lg border border-dashed border-base-300 px-2 py-1.5 text-left text-xs font-medium text-base-content/70 transition hover:border-accent/40 hover:bg-base-200/60"
            >
              <Plus size={15} className="shrink-0" />
              <span className="truncate">{t("workspace.agent.add_new")}</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
