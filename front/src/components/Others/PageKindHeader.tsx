import type { ReactNode } from "react";

import { withAlpha } from "../Sidebar/topicColors";

export type PageKind = "topic" | "workspace";

const ICON_TILE =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl";

/**
 * The compact header both the topic page and the workspace page wear: the
 * kind's icon as a tinted tile, the name, and one line that says what kind of
 * page this is before its chat count ("Topic · 2 chats"). No band behind it,
 * no rule under it — the chat rows start right below, level with the sidebar.
 *
 * It starts at the sidebar's edge rather than in the centred reading column,
 * and it leaves the top-right corner free for the page's floating delete.
 */
type PageKindHeaderProps = {
  kind: PageKind;
  title: string;
  kindLabel: string;
  countLabel: string;
  icon: ReactNode;
  iconColor: string;
  iconLabel: string;
  iconExpanded: boolean;
  onIconClick?: () => void;
  iconTestId: string;
  iconMenu?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
};

export default function PageKindHeader({
  kind,
  title,
  kindLabel,
  countLabel,
  icon,
  iconColor,
  iconLabel,
  iconExpanded,
  onIconClick,
  iconTestId,
  iconMenu,
  leading,
  trailing,
}: PageKindHeaderProps) {
  const iconTileStyle = {
    backgroundColor: withAlpha(iconColor, 0.16),
    color: iconColor,
  };

  return (
    <header data-testid={`${kind}-page-header`} className="shrink-0 px-4 pt-2">
      <div className="flex w-full min-w-0 items-center gap-2.5 pr-12">
        {leading}
        <div className="relative shrink-0">
          {onIconClick ? (
            <button
              type="button"
              data-testid={iconTestId}
              onClick={onIconClick}
              title={iconLabel}
              aria-label={iconLabel}
              aria-expanded={iconExpanded}
              className={ICON_TILE}
              style={iconTileStyle}
            >
              {icon}
            </button>
          ) : (
            <span className={ICON_TILE} style={iconTileStyle} aria-hidden="true">
              {icon}
            </span>
          )}
          {iconMenu}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold text-base-content">
            {title}
          </h1>
          <p className="truncate text-xs text-base-content/70">
            {`${kindLabel} · ${countLabel}`}
          </p>
        </div>
        {trailing}
      </div>
    </header>
  );
}
