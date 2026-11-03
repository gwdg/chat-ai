import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";
import { Add, Bot, ChevronRight } from "@carbon/icons-react";

import { useWorkspaceList } from "../../db/workspaceDb";
import { useModal } from "../../modals/ModalContext";

export default function WorkspaceList({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { openModal } = useModal();
  const workspaces = useWorkspaceList();

  const openCreate = () => openModal("createWorkspace");

  return (
    <div className="px-3 pb-2 pt-2">
      <div className="mb-1 flex items-center justify-between px-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-base-content/45">
          {t("workspace.sidebar_title")}
        </span>
        <button
          type="button"
          onClick={openCreate}
          className="flex h-6 w-6 items-center justify-center rounded-md text-base-content/50 transition hover:bg-base-200 hover:text-accent"
          title={t("workspace.new_workspace")}
          aria-label={t("workspace.new_workspace")}
        >
          <Add size={15} />
        </button>
      </div>

      {workspaces.length === 0 ? (
        <button
          type="button"
          onClick={openCreate}
          className="flex w-full flex-col items-start gap-1 rounded-xl border border-dashed border-base-300 px-3 py-2.5 text-left transition hover:border-primary/40 hover:bg-base-200/60"
        >
          <span className="flex items-center gap-1.5 text-xs font-medium text-base-content/70">
            <Bot size={14} className="text-primary" />
            {t("workspace.empty_sidebar_title")}
          </span>
          <span className="text-[10px] text-base-content/45">
            {t("workspace.empty_sidebar_body")}
          </span>
        </button>
      ) : (
        <div className="space-y-0.5">
          {workspaces.map((workspace) => {
            const active = location.pathname === `/workspace/${workspace.id}`;
            return (
              <button
                key={workspace.id}
                type="button"
                onClick={() => {
                  navigate(`/workspace/${workspace.id}`);
                  onNavigate?.();
                }}
                className={`group flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-base-content hover:bg-base-200"
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                    active ? "bg-primary/15 text-primary" : "bg-base-200 text-base-content/55"
                  }`}
                >
                  <Bot size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium">{workspace.name}</span>
                  <span className="block truncate font-mono text-[10px] text-base-content/40">
                    {workspace.rootPath}
                  </span>
                </span>
                <ChevronRight
                  size={14}
                  className="shrink-0 text-base-content/30 opacity-0 transition group-hover:opacity-100"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
