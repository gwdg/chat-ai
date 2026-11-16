import { Fragment } from "react";
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
  useClose,
} from "@headlessui/react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { DataBase, Workspace } from "@carbon/icons-react";

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

// Inside the popover so `useClose` can dismiss it before the modal opens.
function ManageDataRow({ localState }) {
  const { t } = useTranslation();
  const close = useClose();
  const { openModal } = useModal();

  return (
    <div className="mt-3 border-t border-base-300 pt-2">
      <button
        type="button"
        data-guide="manage-data"
        onClick={() => {
          close();
          openModal("manageData", { localState });
        }}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-base-content transition hover:bg-base-200"
      >
        <DataBase size={16} className="shrink-0 text-accent" />
        <span className="min-w-0 flex-1 truncate">
          {t("workspace.manage_data")}
        </span>
      </button>
    </div>
  );
}

export default function WorkspaceAttachButton({ localState, setLocalState }) {
  const { t } = useTranslation();
  const conversationId = localState?.id;
  const workspaces = useWorkspaceList();
  const links = useChatWorkspaces(conversationId);
  const attached = new Set(links.map((link) => link.workspaceId));

  if (!conversationId) return null;

  const toggle = (workspaceId) => {
    if (attached.has(workspaceId)) {
      void detachWorkspaceChat(workspaceId, conversationId);
    } else {
      void attachWorkspaceChat(workspaceId, conversationId);
    }
  };

  // "Access storage" is the first level of the workspace menu: it decides whether the model can
  // touch any of these files at all. The Manage data view only reports the resulting state.
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
          <p className="mt-1 text-[11px] leading-relaxed text-base-content/60">
            {workspaces.length
              ? t("workspace.chat_workspaces_hint")
              : t("workspace.empty_sidebar_title")}
          </p>
          <div className="mt-2 flex items-start justify-between gap-3 rounded-lg border border-base-300 bg-base-200/40 px-2.5 py-2">
            <div className="min-w-0">
              <p className="text-xs font-medium">
                {t("workspace.access_storage")}
              </p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-base-content/60">
                {storageOn
                  ? t("workspace.access_storage_hint")
                  : t("workspace.access_storage_off_hint")}
              </p>
            </div>
            <input
              type="checkbox"
              data-guide="access-storage"
              className="toggle toggle-success toggle-sm mt-0.5 shrink-0"
              checked={storageOn}
              onChange={(event) => setStorage(event.target.checked)}
              aria-label={t("workspace.access_storage")}
            />
          </div>
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
                  <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
                </button>
              );
            })}
          </div>
          {!workspaces.length && (
            <p className="mt-2 text-[11px] text-base-content/50">
              {t("workspace.chat_workspaces_empty")}
            </p>
          )}
          <div className="mt-3">
            <WorkspaceSettings
              localState={localState}
              setLocalState={setLocalState}
            />
          </div>
          <ManageDataRow localState={localState} />
        </PopoverPanel>
      </Transition>
    </Popover>
  );
}
