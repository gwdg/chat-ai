import { Fragment, useMemo } from "react";
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
  useClose,
} from "@headlessui/react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Check, ChevronRight } from "lucide-react";
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

// Inside the popover so `useClose` can dismiss it before navigating or opening the modal.
function ManageDataRow({ label, onSelect }) {
  const close = useClose();

  return (
    <button
      type="button"
      data-guide="manage-data"
      onClick={() => {
        close();
        onSelect();
      }}
      className="flex w-full items-center gap-2 rounded-lg py-1 pl-1 pr-1 text-left text-xs font-medium text-base-content transition hover:bg-base-200"
    >
      <DataBase size={16} className="shrink-0 text-accent" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <ChevronRight size={12} className="shrink-0 text-base-content/40" />
    </button>
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

  if (!conversationId) return null;

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

  // A workspace owns the files of an attached chat, so a single attachment is opened directly
  // instead of repeating the workspace in the Manage data view. Several attachments need a choice.
  const soleWorkspace =
    attachedWorkspaces.length === 1 ? attachedWorkspaces[0] : null;
  const manageData = () => {
    if (soleWorkspace) {
      navigate(`/workspace/${soleWorkspace.id}`);
      return;
    }
    openModal("manageData", { localState });
  };
  const manageDataLabel = soleWorkspace
    ? t("workspace.manage_data_in", { name: soleWorkspace.name })
    : t("workspace.manage_data");

  const workspaceHint = attachedWorkspaces.length
    ? t("workspace.chat_workspaces_attached_hint", {
        names: attachedWorkspaces.map((workspace) => workspace.name).join(", "),
      })
    : workspaces.length
      ? t("workspace.chat_workspaces_hint")
      : t("workspace.chat_workspaces_none");

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
            <ManageDataRow label={manageDataLabel} onSelect={manageData} />
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
