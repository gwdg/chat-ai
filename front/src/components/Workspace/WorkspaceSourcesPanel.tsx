import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  Boxes,
  ChevronRight,
  HardDrive,
  MessageSquare,
  Plus,
  Server,
} from "lucide-react";

import { useConversationList } from "../../db";
import type { WorkspaceSourceRow } from "../../db/dbTypes";
import type { QuotaInfo } from "../../workspace/providers/types";
import { formatBytes } from "../../utils/formatBytes";
import {
  QuotaMeter,
  useSourceQuotas,
  type SourceTarget,
} from "./WorkspaceSourceBrowser";

export type { SourcesSelection } from "./WorkspaceSourceBrowser";

function DriveCard({
  dataGuide,
  icon: Icon,
  title,
  subtitle,
  quota,
  usageLabel,
  usageTitle,
  broken,
  active,
  onClick,
}: {
  dataGuide: string;
  icon: typeof HardDrive;
  title: string;
  subtitle: string;
  quota?: QuotaInfo | null;
  usageLabel: string;
  usageTitle?: string;
  broken?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-guide={dataGuide}
      aria-pressed={active}
      onClick={onClick}
      title={usageTitle || usageLabel || undefined}
      className={`flex w-full min-w-0 items-start gap-2.5 rounded-xl border px-2 py-2 text-left transition ${
        active
          ? "border-accent bg-accent/10"
          : "border-base-300/70 hover:border-accent/40 hover:bg-base-200/60"
      }`}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1">
          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-base-content">
            {title}
          </span>
          {broken && (
            <span
              role="img"
              aria-label={broken}
              title={broken}
              data-guide="workspace-source-broken"
              className="shrink-0"
            >
              <AlertCircle size={14} className="text-error" />
            </span>
          )}
          <ChevronRight size={14} className="shrink-0 text-base-content/35" />
        </div>
        <div className="mt-0.5 truncate text-[10px] text-base-content/50">
          {subtitle}
        </div>
        <QuotaMeter quota={quota} label={usageLabel} />
      </div>
    </button>
  );
}

export default function WorkspaceSourcesPanel({
  sources,
  activeTarget = null,
  onOpenTarget,
  onAddSource,
  onAddDeviceFolder,
  className = "",
}: {
  sources: WorkspaceSourceRow[];
  activeTarget?: SourceTarget | null;
  onOpenTarget: (target: SourceTarget) => void;
  onAddSource: () => void;
  onAddDeviceFolder?: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const conversations = useConversationList() || [];
  const {
    localSources,
    arcanaSources,
    mcpSources,
    deviceQuota,
    chatsQuota,
    arcanasQuota,
  } = useSourceQuotas(sources);
  const activeDrive = activeTarget?.drive ?? null;
  const usageLabel = (quota: QuotaInfo | null) =>
    quota
      ? t("workspace.source_browser.usage", {
          used: formatBytes(quota.usage),
          quota: formatBytes(quota.quota),
        })
      : "";
  const usageTitle = (quota: QuotaInfo | null) =>
    quota
      ? t("workspace.source_browser.chat_usage", {
          used: formatBytes(quota.usage),
          quota: formatBytes(quota.quota),
        })
      : undefined;

  // A source that failed to connect (or lost its permission) cannot be browsed
  // right now, so its drive card carries a red exclamation with the reason.
  const brokenReason = (rows: WorkspaceSourceRow[]) => {
    const bad = rows.find(
      (row) => row.status === "error" || row.status === "needs-permission",
    );
    if (!bad) return undefined;
    const base = t("workspace.source_browser.source_broken", {
      name: bad.label,
    });
    return bad.error ? `${base} ${bad.error}` : base;
  };
  const chatSources = sources.filter((source) => source.kind === "chat");

  return (
    <section
      data-guide="workspace-sources"
      className={`min-w-0 rounded-xl border border-base-300 bg-base-100 p-1.5 ${className}`}
    >
      <div className="flex h-6 items-center justify-between px-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-base-content/45">
          {t("workspace.source_browser.title")}
        </span>
        <button
          type="button"
          data-guide="workspace-sources-add"
          onClick={onAddSource}
          aria-label={t("workspace.add_source")}
          title={t("workspace.add_source")}
          className="flex h-5 w-5 items-center justify-center rounded text-base-content/55 transition hover:bg-base-200 hover:text-base-content"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="mt-1 flex flex-col gap-1.5">
        <DriveCard
          dataGuide="workspace-source-device"
          icon={HardDrive}
          title={t("workspace.source_browser.device")}
          subtitle={t("workspace.source_browser.folders", {
            count: localSources.length,
          })}
          quota={deviceQuota}
          usageLabel={usageLabel(deviceQuota)}
          broken={brokenReason(localSources)}
          active={activeDrive === "device"}
          onClick={() => onOpenTarget({ drive: "device" })}
        />
        <DriveCard
          dataGuide="workspace-source-chats"
          icon={MessageSquare}
          title={t("workspace.source_browser.chats")}
          subtitle={t("workspace.source_browser.chats_count", {
            count: conversations.length,
          })}
          quota={chatsQuota}
          usageLabel={usageLabel(chatsQuota)}
          usageTitle={usageTitle(chatsQuota)}
          broken={brokenReason(chatSources)}
          active={activeDrive === "chats"}
          onClick={() => onOpenTarget({ drive: "chats" })}
        />
        <DriveCard
          dataGuide="workspace-source-arcanas"
          icon={Boxes}
          title={t("workspace.source_browser.arcanas")}
          subtitle={t("workspace.source_browser.collections", {
            count: arcanaSources.length,
          })}
          quota={arcanasQuota}
          usageLabel={usageLabel(arcanasQuota)}
          broken={brokenReason(arcanaSources)}
          active={activeDrive === "arcanas"}
          onClick={() => onOpenTarget({ drive: "arcanas" })}
        />
        {mcpSources.length > 0 && (
          <DriveCard
            dataGuide="workspace-source-mcp"
            icon={Server}
            title={t("workspace.source_browser.mcp")}
            subtitle={t("workspace.source_browser.servers", {
              count: mcpSources.length,
            })}
            usageLabel=""
            broken={brokenReason(mcpSources)}
            active={activeDrive === "mcp"}
            onClick={() => onOpenTarget({ drive: "mcp" })}
          />
        )}

        {onAddDeviceFolder && (
          <button
            type="button"
            data-guide="workspace-sources-add-device-folder"
            onClick={onAddDeviceFolder}
            className="flex w-full min-w-0 items-center gap-2 rounded-lg border border-dashed border-base-300 px-2 py-1.5 text-left text-[11px] font-medium text-base-content/70 transition hover:border-accent/40 hover:bg-base-200/60"
          >
            <Plus size={14} className="shrink-0" />
            <span className="min-w-0 truncate">
              {t("workspace.source_browser.add_device_folder")}
            </span>
          </button>
        )}
      </div>
    </section>
  );
}
