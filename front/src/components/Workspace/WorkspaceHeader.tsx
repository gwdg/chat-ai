import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import {
  Bot,
  ChevronLeft,
  Folder,
  FolderOpen,
  OverflowMenuVertical,
  TrashCan,
  Workspace,
} from "@carbon/icons-react";

import type { WorkspaceRow } from "../../db/dbTypes";
import { deleteWorkspace } from "../../db/workspaceDb";
import { useModal } from "../../modals/ModalContext";
import { useToast } from "../../hooks/useToast";

export default function WorkspaceHeader({
  workspace,
  status,
  filesOpen,
  onToggleFiles,
}: {
  workspace: WorkspaceRow;
  status: "loading" | "ready" | "thinking" | "tool" | "error";
  filesOpen: boolean;
  onToggleFiles: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { confirmAction } = useModal();
  const { notifySuccess, notifyError } = useToast();

  const statusInfo = {
    loading: { label: t("workspace.status_starting"), className: "bg-base-200 text-base-content/60" },
    ready: { label: t("workspace.status_ready"), className: "bg-success/15 text-success" },
    thinking: { label: t("workspace.status_working"), className: "bg-primary/15 text-primary" },
    tool: { label: t("workspace.status_tools"), className: "bg-accent/15 text-accent" },
    error: { label: t("workspace.status_error"), className: "bg-error/15 text-error" },
  }[status];

  const handleDelete = () => {
    confirmAction(
      {
        warningKey: "warn_delete_workspace",
        messageKey: "workspace.delete_confirm",
        messageValues: { name: workspace.name },
        confirmKey: "common.delete",
        danger: true,
      },
      async () => {
        try {
          await deleteWorkspace(workspace.id);
          notifySuccess(t("workspace.deleted"));
          navigate("/chat");
        } catch (error: any) {
          notifyError(error?.message || t("workspace.delete_error"));
        }
      },
    );
  };

  return (
    <header className="flex shrink-0 items-center gap-3 border-b border-base-300 bg-base-100 px-3 py-2.5 md:px-4">
      <button
        type="button"
        onClick={() => navigate("/chat")}
        className="btn btn-ghost btn-sm btn-circle md:hidden"
        aria-label={t("workspace.back_to_chats")}
      >
        <ChevronLeft size={18} />
      </button>

      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 via-secondary/10 to-accent/15 text-primary ring-1 ring-base-300">
        <Workspace size={20} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-sm font-semibold text-base-content md:text-base">
            {workspace.name}
          </h1>
          <span className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium sm:inline-flex ${statusInfo.className}`}>
            {statusInfo.label}
          </span>
        </div>
        <div className="flex min-w-0 items-center gap-2 text-[11px] text-base-content/50">
          <Folder size={12} className="shrink-0" />
          <code className="truncate">{workspace.rootPath}</code>
          <span className="hidden items-center gap-1 sm:flex">
            <Bot size={12} />
            <span className="truncate">{workspace.modelName || workspace.modelId}</span>
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onToggleFiles}
        className={`btn btn-sm gap-2 ${filesOpen ? "btn-primary" : "btn-ghost"}`}
        aria-pressed={filesOpen}
      >
        {filesOpen ? <FolderOpen size={17} /> : <Folder size={17} />}
        <span className="hidden sm:inline">{t("workspace.files")}</span>
      </button>

      <div className="dropdown dropdown-end">
        <button
          type="button"
          tabIndex={0}
          className="btn btn-ghost btn-sm btn-square"
          aria-label={t("workspace.workspace_menu")}
        >
          <OverflowMenuVertical size={18} />
        </button>
        <ul
          tabIndex={0}
          className="menu dropdown-content z-[1002] mt-1 w-44 rounded-box border border-base-300 bg-base-100 p-1 shadow-xl"
        >
          <li>
            <button type="button" onClick={handleDelete} className="text-error">
              <TrashCan size={15} />
              {t("workspace.delete_workspace")}
            </button>
          </li>
        </ul>
      </div>
    </header>
  );
}
