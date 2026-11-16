import { useEffect, useMemo, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useSearchParams } from "react-router";

import AnnouncementBar from "../components/Header/AnnouncementBar";
import Header from "../components/Header/Header";
import SidebarWrapper from "../components/Sidebar/SidebarWrapper";
import CollapsibleFooter from "../components/Footer/CollapsibleFooter";
import AgentConversation from "../components/Agent/AgentConversation";
import AgentFilesPanel from "../components/Agent/AgentFilesPanel";
import FilePreviewPanel from "../components/DocumentPanel/FilePreviewPanel";
import { useAgent } from "../agents/agentStore";
import {
  disableAgentBridgeAfterFailure,
  isAgentBridgeEnabled,
} from "../agents/agentBridgeAccess";
import {
  fetchAgentSessions,
  switchAgentSession,
} from "../agents/agentSessions";
import { useUpdateModelsData } from "../hooks/useUpdateModelsData";
import { useUpdateUserData } from "../hooks/useUpdateUserData";
import { useOpencodeFilePreview } from "../hooks/useOpencodeFilePreview";
import { useAgentBridge } from "../hooks/useAgentBridge";
import {
  useWorkspaceList,
  useWorkspaceMounts,
  useWorkspaceSources,
} from "../db/workspaceDb";
import { useWorkspaceProviders } from "../workspace/useWorkspaceProviders";
import { createWorkspaceRootProvider } from "../workspace/workspaceRoot";

export default function AgentPage() {
  const { t } = useTranslation();
  const { agentId } = useParams();
  const [searchParams] = useSearchParams();
  const focusedFilePath = searchParams.get("file");
  const sessionParam = searchParams.get("session");
  const agent = useAgent(agentId);
  const modelsData = useUpdateModelsData();
  const userData = useUpdateUserData();
  const { preview, openFile, toggleFile, openText, closePreview, download } =
    useOpencodeFilePreview(agent);
  // Tool cards of the conversation open the file they read or wrote in the same
  // right-hand panel the file list uses, and close it when clicked again.
  const openConversationFile = useCallback(
    (path: string) => {
      if (!agent?.id || !path) return;
      void toggleFile({
        sourceId: agent.id,
        path,
        name: path.split("/").filter(Boolean).pop() || path,
        kind: "file",
        local: false,
      });
    },
    [agent?.id, toggleFile],
  );
  useEffect(() => {
    if (!agent?.id || !sessionParam || sessionParam === agent.sessionId) return;
    let cancelled = false;
    fetchAgentSessions(agent)
      .then((tree) => {
        if (cancelled) return;
        if (tree.all.some((session) => session.id === sessionParam)) {
          switchAgentSession(agent, sessionParam);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [agent, sessionParam]);

  useEffect(() => {
    if (!agent || !focusedFilePath) return;
    void openFile({
      sourceId: agent.id,
      path: focusedFilePath,
      name: focusedFilePath.split("/").filter(Boolean).pop() || focusedFilePath,
      kind: "file",
      local: false,
    });
  }, [agent, focusedFilePath, openFile]);
  const workspaces = useWorkspaceList();
  const bridgeEnabled = isAgentBridgeEnabled(agent);
  const bridgeWorkspaceId =
    agent?.bridgeWorkspaceId ?? workspaces[0]?.id ?? null;
  const workspaceId = bridgeEnabled ? bridgeWorkspaceId : null;
  const sources = useWorkspaceSources(workspaceId ?? undefined);
  const mounts = useWorkspaceMounts(workspaceId ?? undefined);
  const { providers } = useWorkspaceProviders(sources);
  const rootProvider = useMemo(
    () => (workspaceId ? createWorkspaceRootProvider(workspaceId) : null),
    [workspaceId],
  );
  // The bridge runs from this page; its switch, status and options live in the composer's
  // workspace popover (components/Agent/AgentWorkspaceButton.jsx).
  const bridge = useAgentBridge({
    agent,
    workspaceId,
    writable: agent?.bridgeWritable === true,
    mcp: agent?.bridgeMcp === true,
    mounts,
    providers,
    rootProvider,
  });
  // Reason of a bridge that could not start. Access is switched off in that case, so the hook
  // reports "off" afterwards; the popover still shows why until access is turned on again.
  const [bridgeFailure, setBridgeFailure] = useState("");

  useEffect(() => {
    if (!agent) return;
    if (bridge.status === "error") {
      if (disableAgentBridgeAfterFailure(agent, workspaces)) {
        setBridgeFailure(bridge.error || t("agents.bridge.not_working"));
      }
      return;
    }
    if (bridge.status === "online" || bridge.status === "connecting") {
      setBridgeFailure("");
    }
  }, [agent, bridge.status, bridge.error, workspaces, t]);

  const sidebarState = useMemo(
    () => ({ id: "", title: "", messages: [], folderId: null, settings: { model: "" } }),
    [],
  );

  return (
    <div className="h-dvh grid grid-rows-[auto_1fr]">
      <div className="min-w-0 overflow-x-clip">
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
              onOpenFile={toggleFile}
              onShowText={openText}
            />
          )}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {agent ? (
              <AgentConversation
                agent={agent}
                modelsData={modelsData}
                onOpenFile={openConversationFile}
                bridgeStatus={bridge.status}
                bridgeError={bridge.error}
                bridgeFailure={bridgeFailure}
                bridgeUnavailable={bridge.unavailable}
              />
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-base-content/60">
                {t("agents.not_found")}
              </div>
            )}
          </div>
          {agent && preview && (
            <FilePreviewPanel
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
