import { useId } from "react";

export default function ProfilePreferenceSwitch({
  label,
  description,
  checked,
  onChange,
  className = "",
}) {
  const id = useId();
  const labelId = `${id}-label`;
  const descriptionId = `${id}-description`;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelId}
      aria-describedby={description ? descriptionId : undefined}
      onClick={() => onChange(!checked)}
      className={`flex min-h-14 w-full cursor-pointer items-center justify-between gap-4 rounded-lg px-2 py-2 text-left transition-colors hover:bg-base-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${className}`}
    >
      <span className="min-w-0">
        <span
          id={labelId}
          className="block text-sm font-medium text-base-content"
        >
          {label}
        </span>
        {description && (
          <span
            id={descriptionId}
            className="mt-0.5 block text-xs text-base-content/70"
          >
            {description}
          </span>
        )}
      </span>
      <input
        type="checkbox"
        aria-hidden="true"
        tabIndex={-1}
        readOnly
        checked={checked}
        className="toggle toggle-accent pointer-events-none shrink-0"
      />
    </button>
  );
}
