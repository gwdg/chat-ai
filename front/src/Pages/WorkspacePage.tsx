import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Warning } from "@carbon/icons-react";

import AnnouncementBar from "../components/Header/AnnouncementBar";
import CollapsibleFooter from "../components/Footer/CollapsibleFooter";
import Header from "../components/Header/Header";
import SidebarWrapper from "../components/Sidebar/SidebarWrapper";
import WorkspaceComposer from "../components/Workspace/WorkspaceComposer";
import WorkspaceConversation from "../components/Workspace/WorkspaceConversation";
import WorkspaceFilesPanel from "../components/Workspace/WorkspaceFilesPanel";
import WorkspaceHeader from "../components/Workspace/WorkspaceHeader";
import { useUpdateModelsData } from "../hooks/useUpdateModelsData";
import { useUpdateUserData } from "../hooks/useUpdateUserData";
import { useWorkspaceAgent } from "../agent/useWorkspaceAgent";
import { DEFAULT_WORKSPACE_PERSONA } from "../agent/prompt";
import { useWorkspace, updateWorkspace } from "../db/workspaceDb";
import { selectUserSettings } from "../Redux/reducers/userSettingsReducer";
import { getDefaultConversation } from "../utils/conversationUtils";

function buildDraft(workspace: any, userSettings: any) {
  const base = getDefaultConversation(userSettings);
  const persona = (workspace.settings?.system_prompt || DEFAULT_WORKSPACE_PERSONA).trim();
  return {
    ...base,
    id: `workspace-draft-${workspace.id}`,
    title: workspace.name,
    messages: [
      { role: "system", content: [{ type: "text", text: persona }] },
      { role: "user", content: [{ type: "text", text: "" }] },
    ],
    settings: {
      ...base.settings,
      ...workspace.settings,
      system_prompt: persona,
      // `workspace.modelId` is the runtime decision (the agent uses it
      // directly); keep the draft aligned with it instead of trusting a stale
      // copy in settings from before the model was changed.
      model: workspace.modelId
        ? { id: workspace.modelId, name: workspace.modelName || workspace.modelId }
        : workspace.settings?.model || base.settings.model,
    },
  };
}

export default function WorkspacePage() {
  const { workspaceId = "" } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const userSettings = useSelector(selectUserSettings);
  const modelsData = useUpdateModelsData();
  const userData = useUpdateUserData();

  const workspace = useWorkspace(workspaceId);
  const agent = useWorkspaceAgent(workspace);
  const [draftState, setDraftState] = useState<any>(null);
  const [filesOpen, setFilesOpen] = useState(() => window.innerWidth >= 768);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (workspace) {
      setDraftState(buildDraft(workspace, userSettings));
      setSettled(true);
      return;
    }
    const timer = setTimeout(() => setSettled(true), 500);
    return () => clearTimeout(timer);
    // Draft is rebuilt only when the workspace identity changes, not on every
    // live-query update (agent activity updates lastModified).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id]);

  const draft = draftState ?? getDefaultConversation(userSettings);

  const persona = useMemo(() => {
    const value = draft?.messages?.[0]?.content?.[0]?.text;
    return typeof value === "string" ? value : "";
  }, [draft?.messages]);

  const draftModelId = draft?.settings?.model?.id;
  const draftModelName = draft?.settings?.model?.name;
  const draftTemperature = draft?.settings?.temperature;
  const draftTopP = draft?.settings?.top_p;

  // Persist prompt-box settings (model, sampling, persona) on the workspace row.
  useEffect(() => {
    if (!workspace || !draftState) return;
    const settings = workspace.settings ?? {};
    const nextPersona = persona.trim() || DEFAULT_WORKSPACE_PERSONA;
    const draftModel = draftModelId
      ? { id: draftModelId, name: draftModelName || draftModelId }
      : null;
    const modelChanged = Boolean(draftModel && draftModel.id !== workspace.modelId);
    const settingsModelChanged = Boolean(
      draftModel &&
        (settings.model?.id !== draftModel.id ||
          settings.model?.name !== draftModel.name),
    );
    const settingsChanged =
      settingsModelChanged ||
      draftTemperature !== settings.temperature ||
      draftTopP !== settings.top_p ||
      nextPersona !== settings.system_prompt;
    if (!modelChanged && !settingsChanged) return;

    const timer = setTimeout(() => {
      updateWorkspace(workspace.id, {
        ...(modelChanged
          ? { modelId: draftModelId, modelName: draftModelName || draftModelId }
          : {}),
        settings: {
          ...settings,
          ...(draftModel ? { model: draftModel } : {}),
          temperature: draftTemperature,
          top_p: draftTopP,
          system_prompt: nextPersona,
        },
      }).catch((error) => console.error("Could not save workspace settings", error));
    }, 400);
    return () => clearTimeout(timer);
  }, [
    workspace?.id,
    workspace?.modelId,
    draftModelId,
    draftModelName,
    draftTemperature,
    draftTopP,
    persona,
    draftState,
  ]);

  const handleSend = useCallback(
    (payload: any) => {
      agent.send(payload);
    },
    [agent],
  );

  const handleSuggestion = useCallback(
    (text: string) => {
      agent.send({ text, persona });
    },
    [agent, persona],
  );

  if (!workspace) {
    return (
      <div className="grid h-dvh grid-rows-[auto_1fr]">
        <AnnouncementBar />
        <div className="flex items-center justify-center bg-base-200 p-6">
          {!settled ? (
            <span className="loading loading-spinner loading-md text-primary" />
          ) : (
            <div className="w-full max-w-md rounded-2xl border border-base-300 bg-base-100 p-6 text-center shadow-sm">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-base-200 text-base-content/60">
                <Warning size={22} />
              </div>
              <h1 className="text-base font-semibold">{t("workspace.not_found_title")}</h1>
              <p className="mt-1 text-sm text-base-content/60">
                {t("workspace.not_found_body")}
              </p>
              <button
                type="button"
                onClick={() => navigate("/chat")}
                className="btn btn-primary btn-sm mt-4"
              >
                {t("workspace.back_to_chats")}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const promptLoading = agent.status === "thinking" || agent.status === "tool";

  return (
    <div className="grid h-dvh grid-rows-[auto_1fr]">
      <div className="min-w-0 overflow-hidden">
        <AnnouncementBar />
        <Header
          className="md:hidden"
          localState={draft}
          setLocalState={setDraftState}
          modelsData={modelsData}
          userData={userData}
        />
      </div>

      <div className="grid grid-cols-1 grid-rows-[1fr_auto] gap-y-1 overflow-hidden bg-base-200 md:grid-cols-[auto_1fr] md:grid-rows-[1fr_auto] md:gap-x-2 md:pt-1">
        <SidebarWrapper
          localState={draft}
          setLocalState={setDraftState}
          userData={userData}
          modelsData={modelsData}
        />

        <main className="flex min-h-0 min-w-0 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-base-300 bg-base-200/60 shadow-sm md:my-1 md:mr-1">
            <WorkspaceHeader
              workspace={workspace}
              status={agent.status}
              filesOpen={filesOpen}
              onToggleFiles={() => setFilesOpen((open) => !open)}
            />

            <div className="relative flex min-h-0 flex-1 overflow-hidden">
              <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <WorkspaceConversation
                  workspaceName={workspace.name}
                  rootPath={workspace.rootPath}
                  messages={agent.messages}
                  streamingMessage={agent.streamingMessage}
                  status={agent.status}
                  activity={agent.activity}
                  error={agent.error}
                  aborted={agent.aborted}
                  onSuggestion={handleSuggestion}
                  onDismissError={agent.clearError}
                />
                <WorkspaceComposer
                  draftState={draft}
                  setDraftState={setDraftState}
                  userData={userData}
                  modelsData={modelsData}
                  loading={promptLoading}
                  onAbort={agent.abort}
                  onSend={handleSend}
                  workspaceName={workspace.name}
                />
              </section>

              {filesOpen && (
                <div className="absolute inset-0 z-30 bg-base-200/70 p-2 backdrop-blur-sm md:static md:inset-auto md:z-auto md:w-[21rem] md:shrink-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
                  <div className="h-full overflow-hidden rounded-2xl border border-base-300 bg-base-100 md:rounded-none md:border-0 md:border-l">
                    <WorkspaceFilesPanel
                      workspace={workspace}
                      onClose={() => setFilesOpen(false)}
                      onUploaded={() => {}}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

        <CollapsibleFooter className="row-start-3 col-span-full md:row-start-2 md:col-start-1 md:col-end-3" />
      </div>
    </div>
  );
}
