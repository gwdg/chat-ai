import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Checkmark } from "@carbon/icons-react";

import { createFolder } from "../../db";
import { DEFAULT_TOPIC_ICON, TOPIC_ICONS, topicIconById } from "./topicIcons";
import { TOPIC_COLORS, topicColorById } from "./topicColors";

/**
 * Create a topic — an anchored bubble, not a full-screen dialog.
 *
 * Portalled to the body so the sidebar's own overflow never clips it, and
 * positioned beside the button that opened it with a small tail pointing back.
 * Closes on an outside click or Escape, like the other sidebar popovers.
 *
 * Narrow windows keep FolderEditorModal instead — see SidebarContent.
 */

/** Suggested topics. The icon is half the suggestion, so they travel together. */
const SUGGESTIONS: { key: string; icon: string }[] = [
  { key: "homework", icon: "graduation" },
  { key: "writing", icon: "pen" },
  { key: "health", icon: "stethoscope" },
  { key: "research", icon: "microscope" },
];

const BUBBLE_WIDTH = 320;

export default function TopicCreateBubble({
  isOpen,
  onClose,
  anchor,
}: {
  isOpen: boolean;
  onClose: () => void;
  anchor: { x: number; y: number };
}) {
  const { t } = useTranslation();

  const [name, setName] = useState("");
  const [iconId, setIconId] = useState(DEFAULT_TOPIC_ICON.id);
  const [colorId, setColorId] = useState(TOPIC_COLORS[0].id);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const inputRef = useRef<HTMLInputElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setName("");
    setIconId(DEFAULT_TOPIC_ICON.id);
    setColorId(TOPIC_COLORS[0].id);
    setPickerOpen(false);
    setBusy(false);
    setError("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [isOpen]);

  // Escape closes the picker first, then the bubble.
  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (bubbleRef.current && !bubbleRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (pickerOpen) setPickerOpen(false);
      else onClose();
    };
    // Deferred, so the click that opened the bubble does not close it.
    const id = setTimeout(
      () => document.addEventListener("mousedown", onPointerDown),
      0,
    );
    document.addEventListener("keydown", onKeyDown);
    return () => {
      clearTimeout(id);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, pickerOpen, onClose]);

  if (!isOpen) return null;

  const ActiveIcon = topicIconById(iconId).Icon;
  const activeColor = topicColorById(colorId);

  const applySuggestion = (suggestion: (typeof SUGGESTIONS)[number]) => {
    setName(t(`folders.suggestion_${suggestion.key}`));
    setIconId(suggestion.icon);
    setError("");
    inputRef.current?.focus();
  };

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("folders.error_required"));
      inputRef.current?.focus();
      return;
    }
    setBusy(true);
    try {
      await createFolder(trimmed, { icon: iconId, color: colorId });
      onClose();
    } catch {
      setError(t("folders.error_generic"));
    } finally {
      setBusy(false);
    }
  };

  // Clamped so the bubble never leaves the viewport.
  const left = Math.min(
    anchor.x + 12,
    Math.max(8, window.innerWidth - BUBBLE_WIDTH - 8),
  );
  const top = Math.min(anchor.y, Math.max(8, window.innerHeight - 420));
  const tailOffset = anchor.y - top + 20;

  return createPortal(
    <div
      ref={bubbleRef}
      className="fixed z-[999999] w-80 rounded-2xl p-4 shadow-2xl dark:shadow-dark
                 border border-gray-200 dark:border-gray-600
                 bg-white dark:bg-bg_secondary_dark text-black dark:text-white"
      style={{ left, top }}
    >
      {/* Tail pointing back at the trigger button */}
      <div
        className="absolute -left-[6px] h-3 w-3 rotate-45
                   border-l border-b border-gray-200 dark:border-gray-600
                   bg-white dark:bg-bg_secondary_dark"
        style={{ top: tailOffset }}
      />

      {pickerOpen ? (
        /* Icon and colour picker */
        <div className="relative flex flex-col gap-3">
          <div className="flex justify-center pt-1">
            <div
              className="h-14 w-14 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: activeColor.hex }}
            >
              <ActiveIcon size={28} className="text-white" />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {TOPIC_COLORS.map((color) => {
              const selected = color.id === colorId;
              return (
                <button
                  key={color.id}
                  type="button"
                  onClick={() => setColorId(color.id)}
                  aria-label={color.label}
                  aria-pressed={selected}
                  title={color.label}
                  className="relative h-7 w-7 shrink-0 rounded-full cursor-pointer transition-transform"
                  style={{
                    backgroundColor: color.hex,
                    transform: selected ? "scale(1.1)" : undefined,
                  }}
                >
                  {selected && (
                    <Checkmark
                      size={16}
                      className="absolute inset-0 m-auto text-white"
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="h-px bg-gray-200 dark:bg-gray-600" />

          <div className="grid grid-cols-7 gap-1 max-h-44 overflow-y-auto">
            {TOPIC_ICONS.map(({ id, label, Icon }) => {
              const selected = id === iconId;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setIconId(id)}
                  title={label}
                  aria-label={label}
                  aria-pressed={selected}
                  className={`h-9 w-9 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${
                    selected
                      ? ""
                      : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                  style={
                    selected
                      ? {
                          backgroundColor: `${activeColor.hex}22`,
                          color: activeColor.hex,
                        }
                      : undefined
                  }
                >
                  <Icon size={20} />
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setPickerOpen(false)}
            className="self-end rounded-xl px-4 py-1.5 text-sm font-medium cursor-pointer
                       bg-tertiary text-white hover:bg-tertiary/90 transition-colors"
          >
            {t("folders.done")}
          </button>
        </div>
      ) : (
        /* Name and icon */
        <div className="relative flex flex-col gap-4">
          <p className="text-center text-xs leading-5 text-gray-500 dark:text-gray-400">
            {t("folders.create_blurb")}
          </p>

          <div
            className="flex items-center gap-2 rounded-2xl px-3 py-2.5
                       bg-gray-50 dark:bg-bg_dark
                       border border-gray-200 dark:border-gray-600
                       focus-within:border-tertiary transition-colors"
          >
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              aria-label={t("folders.choose_icon")}
              title={t("folders.choose_icon")}
              className="shrink-0 h-8 w-8 rounded-lg flex items-center justify-center
                         cursor-pointer text-white transition-colors"
              style={{ backgroundColor: activeColor.hex }}
            >
              <ActiveIcon size={20} />
            </button>

            <input
              ref={inputRef}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              disabled={busy}
              autoComplete="off"
              spellCheck={false}
              placeholder={t("folders.name_placeholder")}
              className="flex-1 min-w-0 bg-transparent text-sm text-black dark:text-white
                         placeholder:text-gray-400 focus:outline-none disabled:opacity-50"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((suggestion) => {
              const Icon = topicIconById(suggestion.icon).Icon;
              return (
                <button
                  key={suggestion.key}
                  type="button"
                  onClick={() => applySuggestion(suggestion)}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 cursor-pointer
                             border border-gray-200 dark:border-gray-600
                             text-xs font-medium text-black dark:text-white
                             hover:bg-gray-100 dark:hover:bg-gray-700
                             transition-colors disabled:opacity-50"
                >
                  <Icon size={16} className="shrink-0 text-gray-500 dark:text-gray-400" />
                  <span className="truncate">
                    {t(`folders.suggestion_${suggestion.key}`)}
                  </span>
                </button>
              );
            })}
          </div>

          {error && (
            <p className="text-center text-xs text-red-500" role="alert">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-xl px-4 py-2 text-sm font-medium cursor-pointer
                         text-black dark:text-white
                         hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors
                         disabled:opacity-50"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={busy || name.trim().length === 0}
              className="rounded-xl px-4 py-2 text-sm font-medium cursor-pointer
                         bg-tertiary text-white hover:bg-tertiary/90 transition-colors
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? t("folders.creating") : t("common.create")}
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
