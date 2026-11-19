import { Fragment } from "react";
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from "@headlessui/react";
import { useTranslation } from "react-i18next";
import { Check, TriangleAlert } from "lucide-react";
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
  attachedWorkspaces as attachedWorkspaceList,
  isAgentBridgeEnabled,
  resolveBridgeWorkspace,
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
  mcpInjection = null,
}) {
  const { t } = useTranslation();
  const workspaces = useWorkspaceList();
  const links = useAgentWorkspaceLinks(agent?.id);
  const attached = new Set(links.map((link) => link.workspaceId));
  const attachedWorkspaces = attachedWorkspaceList(workspaces, links);
  // An agent with nothing attached cannot start a bridge: it would have to borrow another
  // workspace of the account, which is not what the user connected here.
  const enabled = isAgentBridgeEnabled(agent);
  const accessOn = enabled && attachedWorkspaces.length > 0;
  const bridgeWorkspace = resolveBridgeWorkspace(agent, attachedWorkspaces);

  // `bridgeInjectExternal` splits the configured MCP servers: the ones OpenCode can reach
  // itself become native servers, the rest stay on the relay. The hook reports both lists.
  const injectEnabled = agent?.bridgeInjectExternal === true;
  const injectStatus = mcpInjection?.status || "off";
  const injectInjected = mcpInjection?.injected || [];
  const injectFallback = mcpInjection?.fallback || [];
  const injectError = mcpInjection?.error || "";

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

  // The hint explains the state of the bridge itself. With access on it would only repeat the
  // workspace section, whose own explanation sits under its header (see below).
  const bridgeNote = !workspaces.length
    ? t("workspace.empty_sidebar_title")
    : bridgeUnavailable
      ? t("agents.bridge.unavailable_hint")
      : !attachedWorkspaces.length
        ? t("agents.bridge.needs_workspace")
        : accessOn
          ? ""
          : failed
            ? t("agents.bridge.disabled_after_failure")
            : t("agents.bridge.disabled_hint");

  const toggle = async (workspaceId) => {
    if (attached.has(workspaceId)) {
      await detachWorkspaceAgent(workspaceId, agent.id);
      const remaining = attachedWorkspaces.filter(
        (workspace) => workspace.id !== workspaceId,
      );
      const chosenGone =
        !!agent.bridgeWorkspaceId &&
        !remaining.some(
          (workspace) => workspace.id === agent.bridgeWorkspaceId,
        );
      const patch = {};
      // The exposed workspace must still be attached; without one there is no bridge at all.
      if (chosenGone) patch.bridgeWorkspaceId = remaining[0]?.id ?? null;
      if (!remaining.length) patch.bridgeEnabled = false;
      if (Object.keys(patch).length) updateAgent(agent.id, patch);
      return;
    }
    await attachWorkspaceAgent(workspaceId, agent.id);
    if (!bridgeWorkspace) {
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
              disabled={
                !workspaces.length ||
                bridgeUnavailable ||
                attachedWorkspaces.length === 0
              }
              onChange={(event) =>
                setAgentBridgeEnabled(agent, event.target.checked)
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

          {bridgeNote && (
            <p className="mt-1 text-[11px] leading-relaxed text-base-content/60">
              {bridgeNote}
            </p>
          )}

          {enabled && (
            <div className="mt-2 border-t border-base-300 pt-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-base-content/50">
                {t("agents.bridge.options")}
              </p>
              <div className="mt-1.5 flex flex-col gap-1 text-[11px]">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-xs"
                    disabled={!accessOn}
                    checked={agent?.bridgeWritable === true}
                    onChange={(event) =>
                      updateAgent(agent.id, {
                        bridgeWritable: event.target.checked,
                      })
                    }
                  />
                  <Tooltip
                    text={t("agents.bridge.writable_hint")}
                    className="min-w-0"
                  >
                    {t("agents.bridge.writable")}
                  </Tooltip>
                </label>
              </div>
            </div>
          )}

          {/* The MCP servers have two routes: relaying needs the bridge (and the tab), while an
              injected server is dialled by OpenCode itself, so that row stays available with no
              workspace attached and with workspace access switched off. */}
          <div className="mt-2 border-t border-base-300 pt-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-base-content/50">
              {t("agents.bridge.mcp_servers")}
            </p>
            <div className="mt-1.5 flex flex-col gap-1 text-[11px]">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="checkbox checkbox-xs"
                  disabled={!accessOn}
                  checked={agent?.bridgeMcp === true}
                  onChange={(event) =>
                    updateAgent(agent.id, { bridgeMcp: event.target.checked })
                  }
                />
                <Tooltip
                  text={t("agents.bridge.mcp_hint")}
                  className="min-w-0"
                >
                  <span className="inline-flex items-center gap-1">
                    {t("agents.bridge.mcp")}
                    <TriangleAlert
                      size={11}
                      className="shrink-0 text-warning"
                    />
                  </span>
                </Tooltip>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="checkbox checkbox-xs"
                  checked={injectEnabled}
                  onChange={(event) =>
                    updateAgent(agent.id, {
                      bridgeInjectExternal: event.target.checked,
                    })
                  }
                  aria-label={t("agents.bridge.inject")}
                />
                <Tooltip
                  text={t("agents.bridge.inject_hint")}
                  className="min-w-0"
                >
                  {t("agents.bridge.inject")}
                </Tooltip>
              </label>
              {injectEnabled && (
                <div className="pl-5 text-[10px] leading-snug">
                  {injectStatus === "running" ? (
                    <span className="inline-flex items-center gap-1 text-base-content/60">
                      <span className="loading loading-spinner loading-xs" />
                      {t("agents.bridge.inject_running")}
                    </span>
                  ) : injectStatus === "error" ? (
                    <span className="break-words text-error">
                      {t("agents.bridge.inject_error", {
                        message: injectError,
                      })}
                    </span>
                  ) : injectStatus === "ready" ? (
                    <>
                      <span className="text-base-content/60">
                        {t("agents.bridge.inject_summary", {
                          direct: injectInjected.length,
                          bridge: injectFallback.length,
                        })}
                      </span>
                      {injectFallback.length > 0 && (
                        <span
                          className="mt-0.5 block truncate text-base-content/50"
                          title={injectFallback
                            .map(
                              (server) =>
                                `${server.name}: ${server.error}`,
                            )
                            .join("\n")}
                        >
                          {t("agents.bridge.inject_fallback", {
                            servers: injectFallback
                              .map((server) => server.name)
                              .join(", "),
                          })}
                        </span>
                      )}
                      {!injectInjected.length && !injectFallback.length && (
                        <span className="block text-base-content/50">
                          {t("agents.bridge.inject_none")}
                        </span>
                      )}
                    </>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          {attached.size > 0 && accessOn && (
            <p className="mt-2 text-[10px] leading-snug text-warning">
              {t("agents.bridge.keep_open")}
            </p>
          )}

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-base-300 pt-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-base-content/50">
              {t("agents.workspaces")}
            </span>
            <span className="text-[10px] text-base-content/50">
              {attached.size}
            </span>
          </div>
          {accessOn && workspaces.length > 0 && (
            <p className="mt-1 text-[11px] leading-relaxed text-base-content/60">
              {t("agents.workspaces_hint")}
            </p>
          )}
          <div className="mt-2 flex max-h-56 flex-col gap-0.5 overflow-y-auto">
            {workspaces.map((workspace) => {
              const selected = attached.has(workspace.id);
              // The page falls back to the first attached workspace, so the badge follows the
              // same rule while the agent has no explicit choice yet.
              const active =
                accessOn && bridgeWorkspace?.id === workspace.id;
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
        </PopoverPanel>
      </Transition>
    </Popover>
  );
}
