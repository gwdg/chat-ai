import { Folder, GitRepo, Plug } from "@carbon/icons-react";
import { useTranslation } from "react-i18next";

type SourcePaletteAction = "local" | "git" | "mcp";

type SourcePaletteProps = {
  onPick: (action: SourcePaletteAction) => void;
  mcpEnabled?: boolean;
  size?: "sm" | "md";
  className?: string;
  /** Renders the small uppercase caption above the actions, like the card headings around it. */
  showLabel?: boolean;
};

const ACTIONS: {
  action: SourcePaletteAction;
  labelKey: string;
  Icon: typeof Folder;
}[] = [
  { action: "local", labelKey: "workspace.palette_local", Icon: Folder },
  { action: "git", labelKey: "workspace.palette_git", Icon: GitRepo },
  { action: "mcp", labelKey: "workspace.palette_mcp", Icon: Plug },
];

/**
 * Compact source actions for the workspace Storage card. Labels stay visible so the compact
 * row is still understandable next to the icon-only row actions above it.
 */
export default function SourcePalette({
  onPick,
  mcpEnabled = false,
  size = "sm",
  className = "",
  showLabel = false,
}: SourcePaletteProps) {
  const { t } = useTranslation();
  const visible = ACTIONS.filter(
    (item) => item.action !== "mcp" || mcpEnabled,
  );

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {showLabel && (
        <span className="px-1 text-[10px] font-semibold uppercase tracking-wider text-base-content/45">
          {t("workspace.add_storage")}
        </span>
      )}
      <div
        role="group"
        aria-label={t("workspace.add_storage")}
        className="flex flex-wrap items-center gap-1"
      >
        {visible.map(({ action, labelKey, Icon }) => {
          const label = t(labelKey);
          return (
            <button
              key={action}
              type="button"
              onClick={() => onPick(action)}
              title={label}
              aria-label={label}
              className={`btn min-w-0 justify-start gap-1 rounded-md border border-base-300 bg-base-100 font-normal text-base-content/70 shadow-none hover:border-accent/50 hover:bg-base-200 hover:text-accent ${
                size === "md" ? "btn-sm text-xs" : "btn-xs text-[11px]"
              }`}
            >
              <Icon size={size === "md" ? 14 : 12} className="shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
