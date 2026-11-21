import { Fragment, useMemo, useState } from "react";
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
  useClose,
} from "@headlessui/react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { ArrowLeft, Check, ChevronRight } from "lucide-react";
import { Workspace, DataBase, Folder } from "@carbon/icons-react";

import Tooltip from "../Others/Tooltip";
import WorkspaceSettings from "../Workspace/WorkspaceSettings";
import { useModal } from "../../modals/ModalContext";
import { storageAccessEnabled } from "../../agent/storageAccess";
import {
  attachWorkspaceChat,
  detachWorkspaceChat,
  useChatWorkspaces,
  useWorkspaceList,
} from "../../db/workspaceDb";

/**
 * The inside of the prompt-box Workspace menu. It has two pages, like the Arcana entry of the tools
 * list: the settings (storage switches, Manage Workspace, the attachment list, the local agent) and,
 * when more than one workspace is attached, a page that only lists those workspaces — a back arrow
 * returns to the settings. It lives inside the popover so `useClose` can dismiss it before the
 * editor or the file manager takes over the screen.
 */
function WorkspaceMenu({
  localState,
  setLocalState,
  workspaces,
  attachedWorkspaces,
  attached,
  onToggle,
  onOpenEditor,
  onOpenFiles,
}) {
  const { t } = useTranslation();
  const close = useClose();
  const [page, setPage] = useState("settings");

  // "Access storage" is the master switch: it decides whether the model can touch any of these
  // files at all. It is stored as `tools.browser_storage` (see agent/storageAccess.ts).
  const storageOn = storageAccessEnabled(localState?.settings);
  const setStorage = (enabled) =>
    setLocalState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        tools: { ...prev.settings?.tools, browser_storage: enabled },
      },
      flush: true,
    }));

  // An attached workspace owns the files, so its writing is a switch of its own. The chat's own
  // storage (no workspace) always allows writing.
  const workspaceWriteOn =
    localState?.settings?.tools?.workspace_write_access !== false;
  const setWorkspaceWrite = (enabled) =>
    setLocalState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        tools: { ...prev.settings?.tools, workspace_write_access: enabled },
      },
      flush: true,
    }));

  const edit = (workspaceId) => {
    close();
    onOpenEditor(workspaceId);
  };

  const openFiles = (workspaceId) => {
    close();
    onOpenFiles(workspaceId);
  };

  if (page === "manage" || page === "files") {
    const showFiles = page === "files";
    return (
      <>
        <button
          type="button"
          data-guide="manage-workspace-back"
          onClick={() => setPage("settings")}
          className="mb-1 flex w-full items-center gap-1 rounded-lg px-2 py-1.5 text-left text-xs text-base-content/70 hover:bg-base-200"
        >
          <ArrowLeft size={14} />
          {t("common.back")}
        </button>
        <p className="text-sm font-medium">
          {t(
            showFiles
              ? "workspace.file_manager"
              : "workspace.manage_workspace",
          )}
        </p>
        <div
          data-guide={showFiles ? "file-manager-list" : "manage-workspace-list"}
          className="mt-1 flex flex-col gap-0.5"
        >
          {attachedWorkspaces.map((workspace) => (
            <button
              key={workspace.id}
              type="button"
              data-guide={
                showFiles ? "file-manager-option" : "manage-workspace-option"
              }
              onClick={() =>
                showFiles ? openFiles(workspace.id) : edit(workspace.id)
              }
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-base-content transition hover:bg-base-200"
            >
              {showFiles ? (
                <Folder size={16} className="shrink-0 text-accent" />
              ) : (
                <Workspace size={16} className="shrink-0 text-accent" />
              )}
              <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
              <ChevronRight size={12} className="shrink-0 text-base-content/40" />
            </button>
          ))}
        </div>
      </>
    );
  }

  const workspaceHint = t("workspace.chat_workspaces_attached_hint", {
    names: attachedWorkspaces.map((workspace) => workspace.name).join(", "),
  });

  return (
    <>
      <p className="text-sm font-medium">{t("workspace.chat_workspaces")}</p>

      {/* Storage first: the master switch and the link to the files it covers. */}
      <div className="mt-2">
        <label
          data-guide="access-storage"
          className="flex cursor-pointer select-none items-start gap-2"
        >
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
            checked={storageOn}
            onChange={(event) => setStorage(event.target.checked)}
            aria-label={t("workspace.access_storage")}
          />
          <span className="min-w-0">
            <span className="block text-xs font-medium">
              {t("workspace.access_storage")}
            </span>
            <span className="mt-0.5 block text-[10px] leading-relaxed text-base-content/60">
              {storageOn
                ? t("workspace.access_storage_hint")
                : t("workspace.access_storage_off_hint")}
            </span>
          </span>
        </label>
        <label
          data-guide="workspace-write-access"
          className={`mt-2 flex select-none items-start gap-2 pl-6 ${
            storageOn ? "cursor-pointer" : "cursor-not-allowed opacity-50"
          }`}
        >
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
            checked={workspaceWriteOn}
            disabled={!storageOn}
            onChange={(event) => setWorkspaceWrite(event.target.checked)}
            aria-label={t("settings.label_write_access")}
          />
          <span className="min-w-0">
            <span className="block text-xs font-medium">
              {t("settings.label_write_access")}
            </span>
            <span className="mt-0.5 block text-[10px] leading-relaxed text-base-content/60">
              {t("workspace.workspace_write_access_hint")}
            </span>
          </span>
        </label>
        {/* One attached workspace has nothing to choose between, so it opens straight away; with
            several the row opens the list page instead of a separate dialog. */}
        <button
          type="button"
          data-guide="manage-workspace"
          onClick={() => {
            if (attachedWorkspaces.length > 1) setPage("manage");
            else edit(attachedWorkspaces[0].id);
          }}
          className="flex w-full items-center gap-2 rounded-lg py-1 pl-1 pr-1 text-left text-xs font-medium text-base-content transition hover:bg-base-200"
        >
          <DataBase size={16} className="shrink-0 text-accent" />
          <span className="min-w-0 flex-1 truncate">
            {t("workspace.manage_workspace")}
          </span>
          {attachedWorkspaces.length > 1 && (
            <ChevronRight size={12} className="shrink-0 text-base-content/40" />
          )}
        </button>
        {/* The files as a page of their own: no storage rail, no settings, only the tree. */}
        <button
          type="button"
          data-guide="file-manager"
          onClick={() => {
            if (attachedWorkspaces.length > 1) setPage("files");
            else openFiles(attachedWorkspaces[0].id);
          }}
          className="flex w-full items-center gap-2 rounded-lg py-1 pl-1 pr-1 text-left text-xs font-medium text-base-content transition hover:bg-base-200"
        >
          <Folder size={16} className="shrink-0 text-accent" />
          <span className="min-w-0 flex-1 truncate">
            {t("workspace.file_manager")}
          </span>
          {attachedWorkspaces.length > 1 && (
            <ChevronRight size={12} className="shrink-0 text-base-content/40" />
          )}
        </button>
      </div>

      <div className="mt-3 border-t border-base-300 pt-2">
        <p className="text-[11px] leading-relaxed text-base-content/60">
          {workspaceHint}
        </p>
        {workspaces.length > 0 && (
          <div className="mt-2 flex max-h-56 flex-col gap-0.5 overflow-y-auto">
            {workspaces.map((workspace) => {
              const selected = attached.has(workspace.id);
              return (
                <button
                  key={workspace.id}
                  type="button"
                  onClick={() => onToggle(workspace.id)}
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
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-3">
        <WorkspaceSettings
          localState={localState}
          setLocalState={setLocalState}
        />
      </div>
    </>
  );
}

export default function WorkspaceAttachButton({ localState, setLocalState }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { openModal } = useModal();
  const conversationId = localState?.id;
  const workspaces = useWorkspaceList();
  const links = useChatWorkspaces(conversationId);
  const attached = new Set(links.map((link) => link.workspaceId));
  const attachedWorkspaces = useMemo(
    () =>
      links
        .map((link) =>
          workspaces.find((workspace) => workspace.id === link.workspaceId),
        )
        .filter(Boolean),
    [links, workspaces],
  );

  // A chat without a workspace has no workspace settings to offer: the switch, the editor and the
  // attachment list all describe a workspace this chat does not have. Attaching happens from the
  // workspace side (its options menu), so the button only exists once there is something to show.
  if (!conversationId || attachedWorkspaces.length === 0) return null;

  const toggle = (workspaceId) => {
    if (attached.has(workspaceId)) {
      void detachWorkspaceChat(workspaceId, conversationId);
    } else {
      void attachWorkspaceChat(workspaceId, conversationId);
    }
  };

  // The editor is Create workspace in edit mode: name, icon, colour and the storage rail, which is
  // where a workspace's files (and this chat's files inside it) are managed.
  const openEditor = (workspaceId) =>
    openModal("workspaceEdit", { workspaceId });

  // The file manager is the same tree as a page, without the dialog around it.
  const openFiles = (workspaceId) =>
    navigate(`/workspace/${workspaceId}/files`);

  return (
    <Popover className="relative flex">
      <Tooltip text={t("workspace.chat_workspaces")}>
        <PopoverButton
          data-guide="chat-workspaces"
          className="h-[30px] w-[30px] flex items-center justify-center cursor-pointer focus:outline-none"
          aria-label={t("workspace.chat_workspaces")}
        >
          <Workspace size={24} className="text-accent" />
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
          className="z-[60] w-72 max-w-[calc(100vw-2rem)] max-h-[70vh] overflow-y-auto rounded-xl border border-base-300 bg-base-100 p-3 shadow-xl"
        >
          <WorkspaceMenu
            localState={localState}
            setLocalState={setLocalState}
            workspaces={workspaces}
            attachedWorkspaces={attachedWorkspaces}
            attached={attached}
            onToggle={toggle}
            onOpenEditor={openEditor}
            onOpenFiles={openFiles}
          />
        </PopoverPanel>
      </Transition>
    </Popover>
  );
}
