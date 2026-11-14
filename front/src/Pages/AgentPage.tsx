import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router";

import AnnouncementBar from "../components/Header/AnnouncementBar";
import Header from "../components/Header/Header";
import SidebarWrapper from "../components/Sidebar/SidebarWrapper";
import CollapsibleFooter from "../components/Footer/CollapsibleFooter";
import AgentConversation from "../components/Agent/AgentConversation";
import AgentFilesPanel from "../components/Agent/AgentFilesPanel";
import WorkspaceFilePanel from "../components/Workspace/WorkspaceFilePanel";
import { updateAgent, useAgent } from "../agents/agentStore";
import { useUpdateModelsData } from "../hooks/useUpdateModelsData";
import { useUpdateUserData } from "../hooks/useUpdateUserData";
import { useOpencodeFilePreview } from "../hooks/useOpencodeFilePreview";
import { useAgentBridge } from "../hooks/useAgentBridge";
import {
  useWorkspace,
  useWorkspaceList,
  useWorkspaceMounts,
  useWorkspaceSources,
} from "../db/workspaceDb";
import { useWorkspaceProviders } from "../workspace/useWorkspaceProviders";
import { createWorkspaceRootProvider } from "../workspace/workspaceRoot";

export default function AgentPage() {
  const { t } = useTranslation();
  const { agentId } = useParams();
  const agent = useAgent(agentId);
  const modelsData = useUpdateModelsData();
  const userData = useUpdateUserData();
  const { preview, openFile, openText, closePreview, download } =
    useOpencodeFilePreview(agent);
  const workspaces = useWorkspaceList();
  const workspaceId = agent?.bridgeWorkspaceId ?? null;
  const workspace = useWorkspace(workspaceId ?? undefined);
  const sources = useWorkspaceSources(workspaceId ?? undefined);
  const mounts = useWorkspaceMounts(workspaceId ?? undefined);
  const { providers } = useWorkspaceProviders(sources);
  const rootProvider = useMemo(
    () => (workspaceId ? createWorkspaceRootProvider(workspaceId) : null),
    [workspaceId],
  );
  const bridge = useAgentBridge({
    agent,
    workspaceId,
    writable: agent?.bridgeWritable === true,
    mcp: agent?.bridgeMcp === true,
    mounts,
    providers,
    rootProvider,
  });

  const sidebarState = useMemo(
    () => ({ id: "", title: "", messages: [], folderId: null, settings: { model: "" } }),
    [],
  );

  return (
    <div className="h-dvh grid grid-rows-[auto_1fr]">
      <div className="min-w-0 overflow-hidden">
        <AnnouncementBar />
        <Header
          className="md:hidden"
          localState={sidebarState}
          setLocalState={() => {}}
          modelsData={modelsData}
          userData={userData}
        />
      </div>
      <div className="grid grid-cols-1 grid-rows-[1fr_auto] md:grid-cols-[auto_1fr] md:grid-rows-[1fr_auto] md:gap-x-2 gap-y-1 md:pt-1 bg-base-200 overflow-hidden">
        <SidebarWrapper
          localState={sidebarState}
          setLocalState={() => {}}
          userData={userData}
          modelsData={modelsData}
        />
        <div className="flex min-h-0 min-w-0 gap-2">
          {agent && (
            <AgentFilesPanel
              agent={agent}
              onOpenFile={openFile}
              onShowText={openText}
              workspaces={workspaces}
              workspaceId={workspaceId}
              workspaceName={workspace?.name}
              bridgeStatus={bridge.status}
              bridgeError={bridge.error}
              bridgeWritable={agent?.bridgeWritable === true}
              bridgeMcp={agent?.bridgeMcp === true}
              onWorkspaceChange={(nextWorkspaceId) =>
                updateAgent(agent.id, {
                  bridgeWorkspaceId: nextWorkspaceId || null,
                })
              }
              onBridgeWritableChange={(value) =>
                updateAgent(agent.id, { bridgeWritable: value })
              }
              onBridgeMcpChange={(value) =>
                updateAgent(agent.id, { bridgeMcp: value })
              }
            />
          )}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {agent ? (
              <AgentConversation agent={agent} modelsData={modelsData} />
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-base-content/60">
                {t("agents.not_found")}
              </div>
            )}
          </div>
          {agent && preview && (
            <WorkspaceFilePanel
              preview={preview}
              onClose={closePreview}
              onDownload={download}
            />
          )}
        </div>
        <CollapsibleFooter className="row-start-3 col-span-full md:row-start-2 md:col-start-1 md:col-end-3" />
      </div>
    </div>
  );
}
