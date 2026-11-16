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
import {
  isAgentBridgeEnabled,
  setAgentBridgeEnabled,
} from "../../agents/agentBridgeAccess";

/**
 * Workspace settings of one agent: the access switch, the live bridge status, the attached
 * workspaces, and the write/MCP options of the bridge.
 *
 * `bridgeStatus` / `bridgeError` come from `useAgentBridge` on the agent page; `bridgeFailure`
 * keeps the reason of a bridge that could not start, which is all that is left to show once the
 * page has switched access off again.
 */
export default function AgentWorkspaceButton({
  agent,
  bridgeStatus = "off",
  bridgeError = "",
  bridgeFailure = "",
  bridgeUnavailable = false,
}) {
  const { t } = useTranslation();
  const workspaces = useWorkspaceList();
  const links = useAgentWorkspaceLinks(agent?.id);
  const attached = new Set(links.map((link) => link.workspaceId));
  const accessOn = isAgentBridgeEnabled(agent);

  // A status only says something about a bridge that is meant to run, so nothing is reported
  // while access is off — except the failure that made the page switch access off.
  const status = accessOn ? bridgeStatus : "off";
  const working = status === "online";
  const connecting = status === "connecting";
  const failed =
    bridgeUnavailable ||
    status === "error" ||
    status === "offline" ||
    (!accessOn && !!bridgeFailure);
  const detail = failed
    ? bridgeFailure ||
      bridgeError ||
      (status === "offline" ? t("agents.bridge.offline_hint") : "")
    : "";

  const statusLabel = bridgeUnavailable
    ? t("agents.bridge.unavailable")
    : working
      ? t("agents.bridge.working")
      : connecting
        ? t("agents.bridge.connecting")
        : failed
          ? t("agents.bridge.not_working")
          : t("agents.bridge.off");
  const statusDot = working
    ? "status-success"
    : connecting
      ? "status-warning"
      : failed
        ? "status-error"
        : "status-neutral";
  const statusText = working
    ? "text-success"
    : connecting
      ? "text-warning"
      : failed
        ? "text-error"
        : "text-base-content/60";
  const statusBox = working
    ? "bg-success/10"
    : connecting
      ? "bg-warning/10"
      : failed
        ? "bg-error/10"
        : "bg-base-200/70";

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
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">
              {t("agents.bridge.title")}
            </span>
            <input
              type="checkbox"
              role="switch"
              className="toggle toggle-xs toggle-accent"
              checked={accessOn}
              disabled={!workspaces.length || bridgeUnavailable}
              onChange={(event) =>
                setAgentBridgeEnabled(agent, event.target.checked, workspaces)
              }
              aria-label={t("agents.bridge.title")}
              data-guide="agent-bridge-toggle"
            />
          </div>

          <div
            role="status"
            aria-live="polite"
            data-guide="agent-bridge-status"
            className={`mt-2 flex items-center gap-2 rounded-lg px-2 py-1.5 ${statusBox}`}
          >
            <span className={`status status-xs ${statusDot}`} />
            <span className={`min-w-0 flex-1 text-xs font-medium ${statusText}`}>
              {statusLabel}
            </span>
            {connecting && (
              <span className="loading loading-spinner loading-xs" />
            )}
          </div>
          {detail && (
            <p className="mt-1 break-words text-[10px] leading-snug text-error">
              {detail}
            </p>
          )}

          <p className="mt-1 text-[11px] leading-relaxed text-base-content/60">
            {!workspaces.length
              ? t("workspace.empty_sidebar_title")
              : bridgeUnavailable
                ? t("agents.bridge.unavailable_hint")
                : accessOn
                  ? t("agents.workspaces_hint")
                  : failed
                    ? t("agents.bridge.disabled_after_failure")
                    : t("agents.bridge.disabled_hint")}
          </p>

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-base-300 pt-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-base-content/50">
              {t("agents.workspaces")}
            </span>
            <span className="text-[10px] text-base-content/50">
              {attached.size}
            </span>
          </div>
          <div className="mt-2 flex max-h-56 flex-col gap-0.5 overflow-y-auto">
            {workspaces.map((workspace) => {
              const selected = attached.has(workspace.id);
              // The page falls back to the first workspace, so the badge has to follow the same
              // rule while the agent has no explicit choice yet.
              const active =
                accessOn &&
                (agent.bridgeWorkspaceId ?? workspaces[0]?.id) === workspace.id;
              return (
                <div key={workspace.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void toggle(workspace.id)}
                    aria-pressed={selected}
                    className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition ${
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
                  </button>
                  {/* One workspace is exposed to the agent at a time; this chooses which. */}
                  {selected &&
                    accessOn &&
                    (active ? (
                      <span className="badge badge-accent badge-xs shrink-0">
                        {t("agents.workspace_active")}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          updateAgent(agent.id, {
                            bridgeWorkspaceId: workspace.id,
                          })
                        }
                        className="btn btn-ghost btn-xs shrink-0"
                      >
                        {t("agents.bridge.use_workspace")}
                      </button>
                    ))}
                </div>
              );
            })}
          </div>
          {!workspaces.length && (
            <p className="mt-2 text-[11px] text-base-content/50">
              {t("agents.workspaces_empty")}
            </p>
          )}

          {accessOn && (
            <div className="mt-2 border-t border-base-300 pt-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-base-content/50">
                {t("agents.bridge.options")}
              </p>
              <div className="mt-1.5 flex flex-col gap-1 text-[11px]">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-xs"
                    checked={agent?.bridgeWritable === true}
                    onChange={(event) =>
                      updateAgent(agent.id, {
                        bridgeWritable: event.target.checked,
                      })
                    }
                  />
                  {t("agents.bridge.writable")}
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-xs"
                    checked={agent?.bridgeMcp === true}
                    onChange={(event) =>
                      updateAgent(agent.id, { bridgeMcp: event.target.checked })
                    }
                  />
                  {t("agents.bridge.mcp")}
                </label>
              </div>
            </div>
          )}

          {attached.size > 0 && accessOn && (
            <p className="mt-2 text-[10px] leading-snug text-warning">
              {t("agents.bridge.keep_open")}
            </p>
          )}
        </PopoverPanel>
      </Transition>
    </Popover>
  );
}
