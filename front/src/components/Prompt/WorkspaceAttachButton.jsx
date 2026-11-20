import { Fragment, useMemo, useState } from "react";
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
  useClose,
} from "@headlessui/react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import { Workspace, DataBase } from "@carbon/icons-react";

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
 * "Manage Workspace": one attached workspace opens its editor straight away; several expand a list
 * of those workspaces in the popover itself, and picking one opens the same editor for it. Lives
 * inside the popover so `useClose` can dismiss it before the modal takes over the screen.
 */
function ManageWorkspaceMenu({ workspaces, label, onEdit }) {
  const close = useClose();
  const [open, setOpen] = useState(false);
  const expandable = workspaces.length > 1;

  const edit = (workspaceId) => {
    close();
    onEdit(workspaceId);
  };

  return (
    <div>
      <button
        type="button"
        data-guide="manage-workspace"
        aria-expanded={expandable ? open : undefined}
        onClick={() => {
          if (expandable) setOpen((value) => !value);
          else edit(workspaces[0].id);
        }}
        className="flex w-full items-center gap-2 rounded-lg py-1 pl-1 pr-1 text-left text-xs font-medium text-base-content transition hover:bg-base-200"
      >
        <DataBase size={16} className="shrink-0 text-accent" />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {expandable &&
          (open ? (
            <ChevronDown size={12} className="shrink-0 text-base-content/40" />
          ) : (
            <ChevronRight size={12} className="shrink-0 text-base-content/40" />
          ))}
      </button>
      {expandable && open && (
        <div
          data-guide="manage-workspace-list"
          className="mt-0.5 flex flex-col gap-0.5"
        >
          {workspaces.map((workspace) => (
            <button
              key={workspace.id}
              type="button"
              data-guide="manage-workspace-option"
              onClick={() => edit(workspace.id)}
              className="flex w-full items-center gap-2 rounded-lg py-1 pl-7 pr-1 text-left text-xs text-base-content transition hover:bg-base-200"
            >
              <Workspace size={14} className="shrink-0 text-accent" />
              <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
              <ChevronRight size={12} className="shrink-0 text-base-content/40" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function WorkspaceAttachButton({ localState, setLocalState }) {
  const { t } = useTranslation();
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

  // The editor is Create workspace in edit mode: name, icon, colour and the storage rail, which is
  // where a workspace's files (and this chat's files inside it) are managed.
  const manageWorkspace = (workspaceId) =>
    openModal("workspaceEdit", { workspaceId });

  const workspaceHint = t("workspace.chat_workspaces_attached_hint", {
    names: attachedWorkspaces.map((workspace) => workspace.name).join(", "),
  });

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
            {attachedWorkspaces.length > 0 && (
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
                  onChange={(event) =>
                    setWorkspaceWrite(event.target.checked)
                  }
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
            )}
            <ManageWorkspaceMenu
              workspaces={attachedWorkspaces}
              label={t("workspace.manage_workspace")}
              onEdit={manageWorkspace}
            />
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
                      onClick={() => toggle(workspace.id)}
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
        </PopoverPanel>
      </Transition>
    </Popover>
  );
}
