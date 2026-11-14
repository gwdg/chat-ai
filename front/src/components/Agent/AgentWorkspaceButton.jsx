import { Fragment } from "react";
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from "@headlessui/react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { Workspace } from "@carbon/icons-react";

import Tooltip from "../Others/Tooltip";
import {
  attachWorkspaceAgent,
  detachWorkspaceAgent,
  useAgentWorkspaceLinks,
  useWorkspaceList,
} from "../../db/workspaceDb";
import { updateAgent } from "../../agents/agentStore";

export default function AgentWorkspaceButton({ agent }) {
  const { t } = useTranslation();
  const workspaces = useWorkspaceList();
  const links = useAgentWorkspaceLinks(agent?.id);
  const attached = new Set(links.map((link) => link.workspaceId));

  const toggle = async (workspaceId) => {
    if (attached.has(workspaceId)) {
      await detachWorkspaceAgent(workspaceId, agent.id);
      if (agent.bridgeWorkspaceId === workspaceId) {
        const next = links.find((link) => link.workspaceId !== workspaceId);
        updateAgent(agent.id, {
          bridgeWorkspaceId: next?.workspaceId ?? null,
        });
      }
      return;
    }
    await attachWorkspaceAgent(workspaceId, agent.id);
    if (!agent.bridgeWorkspaceId) {
      updateAgent(agent.id, { bridgeWorkspaceId: workspaceId });
    }
  };

  return (
    <Popover className="relative flex">
      <Tooltip text={t("agents.workspaces")}>
        <PopoverButton
          data-guide="agent-workspaces"
          className="flex h-7 w-7 items-center justify-center rounded-md text-accent hover:bg-base-200 focus:outline-none"
          aria-label={t("agents.workspaces")}
        >
          <Workspace size={20} />
        </PopoverButton>
      </Tooltip>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-150"
        enterFrom="opacity-0 translate-y-1"
        enterTo="opacity-100 translate-y-0"
        leave="transition ease-in duration-100"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 translate-y-1"
      >
        <PopoverPanel
          anchor="bottom"
          className="z-[60] max-h-[70vh] w-72 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-base-300 bg-base-100 p-3 shadow-xl"
        >
          <p className="text-sm font-medium">{t("agents.workspaces")}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-base-content/60">
            {workspaces.length
              ? t("agents.workspaces_hint")
              : t("workspace.empty_sidebar_title")}
          </p>
          <div className="mt-2 flex max-h-56 flex-col gap-0.5 overflow-y-auto">
            {workspaces.map((workspace) => {
              const selected = attached.has(workspace.id);
              const active = agent.bridgeWorkspaceId === workspace.id;
              return (
                <button
                  key={workspace.id}
                  type="button"
                  onClick={() => void toggle(workspace.id)}
                  aria-pressed={selected}
                  className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition ${
                    selected
                      ? "bg-accent/10 text-accent"
                      : "text-base-content hover:bg-base-200"
                  }`}
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded border border-base-300">
                    {selected && <Check size={12} />}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {workspace.name}
                  </span>
                  {active && (
                    <span className="badge badge-accent badge-xs">
                      {t("agents.workspace_active")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {!workspaces.length && (
            <p className="mt-2 text-[11px] text-base-content/50">
              {t("agents.workspaces_empty")}
            </p>
          )}
          {attached.size > 0 && (
            <p className="mt-2 text-[10px] leading-snug text-warning">
              {t("agents.bridge.keep_open")}
            </p>
          )}
        </PopoverPanel>
      </Transition>
    </Popover>
  );
}
