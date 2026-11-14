import { useState } from "react";
import { useTranslation } from "react-i18next";

export default function AgentFormCard({
  form,
  onReply,
  replying = false,
  readOnly = false,
}) {
  const { t } = useTranslation();
  const [answers, setAnswers] = useState(() => {
    const initial = {};
    for (const field of form.fields ?? []) {
      if (field.default !== undefined) initial[field.key] = field.default;
    }
    return initial;
  });
  const setValue = (key, value) =>
    setAnswers((current) => ({ ...current, [key]: value }));

  return (
    <div className="space-y-2 rounded-xl border border-base-300 p-3">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 text-sm font-medium">{form.title}</p>
        {readOnly && (
          <span className="badge badge-ghost badge-xs">
            {t("agents.form_not_answered")}
          </span>
        )}
      </div>
      {(form.fields ?? []).map((field) => {
        if (field.hidden) return null;
        const value = answers[field.key];
        if (field.type === "boolean") {
          return (
            <label key={field.key} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                disabled={readOnly}
                checked={value === true}
                onChange={(event) => setValue(field.key, event.target.checked)}
              />
              {field.title || field.key}
            </label>
          );
        }
        if (field.type === "multiselect") {
          return (
            <label key={field.key} className="flex flex-col gap-1 text-xs">
              <span>{field.title || field.key}</span>
              <select
                multiple
                disabled={readOnly}
                value={Array.isArray(value) ? value : []}
                onChange={(event) =>
                  setValue(
                    field.key,
                    Array.from(
                      event.target.selectedOptions,
                      (option) => option.value,
                    ),
                  )
                }
                className="select select-bordered w-full"
              >
                {(field.options ?? []).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          );
        }
        if (field.type === "external") {
          return (
            <p key={field.key} className="text-xs text-warning">
              {t("agents.tools.unsupported_field", {
                field: field.title || field.key,
              })}
            </p>
          );
        }
        return (
          <label key={field.key} className="flex flex-col gap-1 text-xs">
            <span>{field.title || field.key}</span>
            <input
              type={
                field.type === "number" || field.type === "integer"
                  ? "number"
                  : "text"
              }
              disabled={readOnly}
              value={value ?? ""}
              onChange={(event) =>
                setValue(
                  field.key,
                  field.type === "number" || field.type === "integer"
                    ? Number(event.target.value)
                    : event.target.value,
                )
              }
              placeholder={field.placeholder}
              className="input input-bordered input-sm w-full"
            />
          </label>
        );
      })}
      {readOnly ? null : (
        <button
          type="button"
          className="btn btn-accent btn-sm"
          disabled={replying}
          onClick={() => onReply(form, answers)}
        >
          {replying ? t("agents.tools.working") : t("agents.tools.submit")}
        </button>
      )}
    </div>
  );
}
