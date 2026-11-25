import { useTranslation } from "react-i18next";
import { Checkmark } from "@carbon/icons-react";

import { TOPIC_ICONS, topicIconById } from "./topicIcons";
import { TOPIC_COLORS, topicColorById } from "./topicColors";

/**
 * The one icon-and-colour picker.
 *
 * Used by the create-workspace dialog, the topic and workspace headers and the
 * topic-create bubble, so the same eight swatches and glyph grid appear
 * everywhere and behave the same way.
 *
 * The parent owns the values: every swatch and glyph reports its id at once, so
 * a page can preview the choice live. Cancel means "put back what it was when
 * this opened" and is the caller's job, because only the caller knows where the
 * values are stored.
 */
export default function IconColorPicker({
  icon,
  color,
  onIconChange,
  onColorChange,
  onCancel,
  onDone,
  testIdPrefix = "icon-color",
  className = "",
}: {
  icon: string;
  color: string;
  onIconChange: (id: string) => void;
  onColorChange: (id: string) => void;
  onCancel: () => void;
  onDone: () => void;
  testIdPrefix?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const SelectedIcon = topicIconById(icon).Icon;
  const activeColor = topicColorById(color);

  return (
    <div
      role="dialog"
      aria-label={t("folders.choose_icon")}
      data-testid={`${testIdPrefix}-picker`}
      className={`flex flex-col gap-2 ${className}`}
    >
      <div className="flex justify-center">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ backgroundColor: activeColor.hex }}
        >
          <SelectedIcon size={28} className="text-white" />
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-1.5">
        {TOPIC_COLORS.map((option) => {
          const selected = color === option.id;
          return (
            <button
              key={option.id}
              type="button"
              data-testid={`${testIdPrefix}-color-${option.id}`}
              onClick={() => onColorChange(option.id)}
              aria-label={option.label}
              aria-pressed={selected}
              title={option.label}
              className="relative h-7 w-7 shrink-0 rounded-full transition-transform"
              style={{
                backgroundColor: option.hex,
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

      <div className="h-px bg-base-300" />

      <div className="grid max-h-44 grid-cols-7 gap-1 overflow-y-auto">
        {TOPIC_ICONS.map((item) => {
          const Icon = item.Icon;
          const selected = icon === item.id;
          return (
            <button
              key={item.id}
              type="button"
              data-testid={`${testIdPrefix}-icon-${item.id}`}
              onClick={() => onIconChange(item.id)}
              aria-pressed={selected}
              aria-label={item.label}
              title={item.label}
              className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${
                selected ? "" : "text-base-content/70 hover:bg-base-200"
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

      <div className="flex justify-end gap-1.5">
        <button
          type="button"
          data-testid={`${testIdPrefix}-cancel`}
          onClick={onCancel}
          className="btn btn-ghost btn-sm"
        >
          {t("common.cancel")}
        </button>
        <button
          type="button"
          data-testid={`${testIdPrefix}-done`}
          onClick={onDone}
          className="btn btn-accent btn-sm"
        >
          {t("folders.done")}
        </button>
      </div>
    </div>
  );
}
