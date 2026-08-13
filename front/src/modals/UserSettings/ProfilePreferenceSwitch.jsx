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
      className={`flex min-h-14 w-full cursor-pointer items-center justify-between gap-4 rounded-lg px-2 py-2 text-left transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tertiary/50 dark:hover:bg-gray-800/60 ${className}`}
    >
      <span className="min-w-0">
        <span
          id={labelId}
          className="block text-sm font-medium text-gray-800 dark:text-gray-100"
        >
          {label}
        </span>
        {description && (
          <span
            id={descriptionId}
            className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400"
          >
            {description}
          </span>
        )}
      </span>
      <span
        aria-hidden="true"
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-tertiary" : "bg-gray-300 dark:bg-gray-600"
        }`}
      >
        <span
          className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}
