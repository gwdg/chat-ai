import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { ChevronDown, PinFilled } from "@carbon/icons-react";

import {
  selectCollapsedTopics,
  toggleTopic,
} from "../../Redux/reducers/interfaceSettingsSlice";
import { useAgents } from "../../agents/agentStore";
import { isAgentsEnabled } from "../../utils/modules";
import { useWorkspaceList } from "../../db/workspaceDb";
import { PINNED_COLLAPSE_ID } from "./TopicList";

/**
 * Top-level sidebar section for pinned chats, topics, workspaces and agents.
 *
 * It sits above the Chats section and owns its own collapse state
 * (`__pinned__`), so folding the chats list does not hide the pinned items.
 * The rows themselves are the real list rows: `TopicList`, `WorkspaceList` and
 * `AgentList` are rendered here with `variant="pinned"`, so a pinned workspace
 * or agent keeps its whole subtree (attached chats, agents and sessions).
 */
export default function PinnedSection({
  children,
  chatCount = 0,
  showAgents = isAgentsEnabled(),
}: {
  children?: ReactNode;
  chatCount?: number;
  showAgents?: boolean;
}) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const workspaces = useWorkspaceList();
  const agents = useAgents();
  const collapsedTopicIds = useSelector(selectCollapsedTopics) ?? [];

  const pinnedWorkspaceCount = workspaces.filter(
    (workspace) => workspace.pinned === true,
  ).length;
  const pinnedAgentCount = showAgents
    ? agents.filter((agent) => agent.pinned === true).length
    : 0;
  const count = chatCount + pinnedWorkspaceCount + pinnedAgentCount;
  if (count === 0) return null;

  const collapsed = collapsedTopicIds.includes(PINNED_COLLAPSE_ID);

  return (
    <div className="px-3 pt-3 pb-1" data-guide="pinned-section">
      <div className="-mx-2 mb-1 flex min-h-8 items-center gap-1 rounded-lg bg-base-200/70 px-3 py-1">
        <button
          type="button"
          onClick={() => dispatch(toggleTopic(PINNED_COLLAPSE_ID))}
          aria-expanded={!collapsed}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-1 rounded-md text-left text-[11px] font-semibold uppercase tracking-wide text-base-content/70 transition hover:text-base-content"
        >
          <ChevronDown
            size={12}
            className={`shrink-0 transition-transform ${collapsed ? "-rotate-90" : ""}`}
          />
          <PinFilled size={12} className="shrink-0" />
          <span className="truncate">{t("folders.pinned")}</span>
        </button>
        <span className="text-[11px] font-normal tabular-nums text-base-content/35">
          {count}
        </span>
      </div>

      {collapsed ? null : (
        <div className="flex flex-col gap-1">{children}</div>
      )}
    </div>
  );
}
