import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router";
import {
  Bot,
  ChevronDown,
  PinFilled,
} from "@carbon/icons-react";

import {
  selectCollapsedTopics,
  toggleTopic,
} from "../../Redux/reducers/interfaceSettingsSlice";
import { setAgentPinned, useAgents } from "../../agents/agentStore";
import { isAgentsEnabled } from "../../utils/modules";
import { setWorkspacePinned, useWorkspaceList } from "../../db/workspaceDb";
import { PINNED_COLLAPSE_ID } from "./TopicList";
import { topicIconById } from "./topicIcons";
import { topicColor, withAlpha } from "./topicColors";

/**
 * Top-level sidebar section for pinned chats, topics, workspaces and agents.
 *
 * It sits above the Chats section and owns its own collapse state
 * (`__pinned__`), so folding the chats list does not hide the pinned items.
 * Pinned chats and topics are rendered by `TopicList` (it owns their rows and
 * menus) and passed in as children; the workspace and agent rows live here
 * because they are plain links in this section.
 */
export default function PinnedSection({
  children,
  chatCount = 0,
}: {
  children?: ReactNode;
  chatCount?: number;
}) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const workspaces = useWorkspaceList();
  const agents = useAgents();
  const collapsedTopicIds = useSelector(selectCollapsedTopics) ?? [];

  const pinnedWorkspaces = workspaces.filter(
    (workspace) => workspace.pinned === true,
  );
  const pinnedAgents = isAgentsEnabled()
    ? agents.filter((agent) => agent.pinned === true)
    : [];
  const count = chatCount + pinnedWorkspaces.length + pinnedAgents.length;
  if (count === 0) return null;

  const collapsed = collapsedTopicIds.includes(PINNED_COLLAPSE_ID);

  return (
    <div className="px-3 pt-3 pb-1" data-guide="pinned-section">
      <div className="mb-1 flex items-center justify-between rounded-lg bg-base-200/70 px-2 py-1">
        <button
          type="button"
          onClick={() => dispatch(toggleTopic(PINNED_COLLAPSE_ID))}
          aria-expanded={!collapsed}
          className="flex min-w-0 flex-1 items-center gap-1 rounded-md text-left text-[11px] font-semibold uppercase tracking-wide text-base-content/70 transition hover:text-base-content"
        >
          <ChevronDown
            size={12}
            className={`shrink-0 transition-transform ${collapsed ? "-rotate-90" : ""}`}
          />
          <PinFilled size={12} className="shrink-0" />
          <span className="truncate">{t("folders.pinned")}</span>
          <span className="ml-1 font-normal tabular-nums text-base-content/35">
            {count}
          </span>
        </button>
      </div>

      {collapsed ? null : (
        <div className="flex flex-col gap-1">
          {children}
          {pinnedWorkspaces.map((workspace) => {
            const WorkspaceIcon = topicIconById(workspace.icon).Icon;
            const color = topicColor({
              id: workspace.id,
              color: workspace.color,
            });
            return (
              <div
                key={workspace.id}
                className="group flex items-center gap-2 rounded-xl px-2 py-1 text-base-content transition hover:bg-base-200"
                data-guide="pinned-workspace"
              >
                <PinnedMarker />
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded"
                  style={{
                    color: color.hex,
                    backgroundColor: withAlpha(color.hex, 0.12),
                  }}
                >
                  <WorkspaceIcon size={13} />
                </span>
                <button
                  type="button"
                  onClick={() => navigate(`/workspace/${workspace.id}`)}
                  className="min-w-0 flex-1 truncate text-left text-xs"
                  title={workspace.name}
                >
                  {workspace.name}
                </button>
                <button
                  type="button"
                  onClick={() => void setWorkspacePinned(workspace.id, false)}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-base-content/40 opacity-0 transition hover:bg-base-300 hover:text-base-content focus:opacity-100 group-hover:opacity-100"
                  title={t("workspace.unpin_action")}
                  aria-label={t("workspace.unpin_action")}
                >
                  <PinFilled size={12} />
                </button>
              </div>
            );
          })}
          {pinnedAgents.map((agent) => (
            <div
              key={agent.id}
              className="group flex items-center gap-2 rounded-xl px-2 py-1 text-base-content transition hover:bg-base-200"
              data-guide="pinned-agent"
            >
              <PinnedMarker />
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-base-content/50">
                <Bot size={13} />
              </span>
              <button
                type="button"
                onClick={() => navigate(`/agent/${agent.id}`)}
                className="min-w-0 flex-1 truncate text-left text-xs"
                title={agent.serverUrl || agent.name}
              >
                {agent.name}
              </button>
              <button
                type="button"
                onClick={() => setAgentPinned(agent.id, false)}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-base-content/40 opacity-0 transition hover:bg-base-300 hover:text-base-content focus:opacity-100 group-hover:opacity-100"
                title={t("agents.unpin_action")}
                aria-label={t("agents.unpin_action")}
              >
                <PinFilled size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Pinned rows use a dash where a group row shows its expand chevron. */
function PinnedMarker() {
  return (
    <span
      aria-hidden="true"
      className="flex h-5 w-4 shrink-0 select-none items-center justify-center text-xs leading-none text-base-content/50"
    >
      -
    </span>
  );
}
