import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import MetaChangesPanel from "../Meta/MetaChangesPanel";
import { useWorkspaceList } from "../../db/workspaceDb";
import WorkspaceAgentPanel from "./WorkspaceAgentPanel";
import WorkspaceStorageTree from "./WorkspaceStorageTree";

const sectionHeading =
  "mb-1 truncate px-1 text-[10px] font-semibold uppercase tracking-wider text-base-content/45";

/**
 * The workspace's right-hand column: What's new, Files, Agents.
 *
 * A workspace page and a chat attached to that workspace render this same
 * component, so the column is identical in both places. A chat may belong to
 * more than one workspace; then each workspace gets its own tree and agent
 * panel under a heading with its name.
 */
function WorkspaceFilesTab({ workspaceIds }) {
  if (workspaceIds.length === 1) {
    return (
      <WorkspaceStorageTree
        workspaceId={workspaceIds[0]}
        className="min-h-0 min-w-0"
        showTitle={false}
      />
    );
  }
  return (
    <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
      {workspaceIds.map((workspaceId) => (
        <WorkspaceStorageTree
          key={workspaceId}
          workspaceId={workspaceId}
          className="min-h-0 min-w-0"
          showTitle={false}
        />
      ))}
    </div>
  );
}

function WorkspaceAgentsTab({ workspaceIds, names }) {
  if (workspaceIds.length === 1) {
    return (
      <WorkspaceAgentPanel workspaceId={workspaceIds[0]} framed={false} />
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {workspaceIds.map((workspaceId) => (
        <section key={workspaceId} className="min-w-0">
          <h3 className={sectionHeading}>{names.get(workspaceId) ?? ""}</h3>
          <WorkspaceAgentPanel workspaceId={workspaceId} framed={false} />
        </section>
      ))}
    </div>
  );
}

export default function WorkspaceRightPanel({
  workspaceIds,
  userSettings,
  scope,
  scopeKey,
}) {
  const { t } = useTranslation();
  const workspaces = useWorkspaceList() ?? [];

  const ids = useMemo(
    () => [...new Set((workspaceIds ?? []).filter(Boolean))],
    [workspaceIds],
  );
  const names = useMemo(
    () => new Map(workspaces.map((workspace) => [workspace.id, workspace.name])),
    [workspaces],
  );
  const tabs = useMemo(
    () => [
      {
        id: "files",
        label: t("workspace.files_tab"),
        content: <WorkspaceFilesTab workspaceIds={ids} />,
      },
      {
        id: "agents",
        label: t("meta_chat.agents_tab"),
        content: <WorkspaceAgentsTab workspaceIds={ids} names={names} />,
      },
    ],
    [ids, names, t],
  );

  if (!ids.length) return null;

  return (
    <MetaChangesPanel
      userSettings={userSettings}
      scope={scope}
      scopeKey={scopeKey}
      tabs={tabs}
    />
  );
}
