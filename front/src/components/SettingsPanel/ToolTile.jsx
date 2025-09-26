// components/settings/ToolTile.jsx
import React from "react";
import PropTypes from "prop-types";

/**
 * Pure presentational tile used by ToolsContainer.
 * Controls only visuals & click. Dark-mode friendly.
 */
export default function ToolTile({
  enabledGlobally,
  active,
  onToggle,
  Icon,
  label,
  size = "md",
}) {
  const isDisabled = !enabledGlobally;

  // Compact, consistent sizes (kept small as requested)
  const tileSize =
    size === "sm"
      ? "aspect-square w-[56px] sm:w-[60px] md:w-[64px] lg:w-[68px]"
      : size === "lg"
      ? "aspect-square w-[76px] sm:w-[80px] md:w-[84px] lg:w-[88px]"
      : "aspect-square w-[66px] sm:w-[70px] md:w-[74px] lg:w-[78px]";

  const iconSize =
    size === "sm"
      ? "h-[22px] w-[22px] md:h-[24px] md:w-[24px]"
      : size === "lg"
      ? "h-[30px] w-[30px] md:h-[32px] md:w-[32px]"
      : "h-[26px] w-[26px] md:h-[28px] md:w-[28px]";

  return (
    <button
      type="button"
      onClick={() => !isDisabled && onToggle(!active)}
      title={label}
      aria-label={label}
      aria-pressed={active}
      aria-disabled={isDisabled}
      className={[
        "group relative isolate box-border rounded-2xl border",
        "flex items-center justify-center",
        tileSize,
        "transition-all duration-150",
        isDisabled
          ? "cursor-not-allowed opacity-60 border-gray-200 text-gray-400 bg-gray-50 dark:border-gray-700 dark:text-gray-500 dark:bg-gray-800/40"
          : active
          ? "cursor-pointer border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500 dark:border-emerald-500/70 dark:bg-emerald-900/20 dark:text-emerald-200 dark:ring-emerald-400"
          : "cursor-pointer border-gray-200 bg-white text-gray-700 hover:shadow-sm hover:-translate-y-0.5 outline outline-1 outline-transparent hover:outline-emerald-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:outline-emerald-500/30",
      ].join(" ")}
    >
      {/* subtle background dot grid */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity group-hover:opacity-100 bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.05)_1px,transparent_0)] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.06)_1px,transparent_0)] bg-[length:10px_10px]"
      />
      <Icon
        className={[
          "relative transition-transform",
          iconSize,
          isDisabled ? "" : active ? "scale-105" : "group-hover:scale-105",
        ].join(" ")}
      />
      {/* tiny status dot */}
      <span
        aria-hidden
        className={[
          "absolute bottom-1.5 h-1.5 w-1.5 rounded-full",
          isDisabled
            ? "bg-gray-300 dark:bg-gray-600"
            : active
            ? "bg-emerald-600 dark:bg-emerald-400"
            : "bg-gray-200 group-hover:bg-emerald-300 dark:group-hover:bg-emerald-400/70",
        ].join(" ")}
      />
    </button>
  );
}

ToolTile.propTypes = {
  enabledGlobally: PropTypes.bool.isRequired,
  active: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  Icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  size: PropTypes.oneOf(["sm", "md", "lg"]),
};
