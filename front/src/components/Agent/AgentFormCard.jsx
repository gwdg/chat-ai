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
      const key = field.key ?? field.name;
      if (field.default !== undefined) initial[key] = field.default;
      else if (field.value !== undefined) initial[key] = field.value;
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
        const key = field.key ?? field.name;
        const label = field.title || field.name || key;
        const value = answers[key];
        const options = Array.isArray(field.options) ? field.options : [];
        const multiple =
          field.type === "multiselect" ||
          field.type === "multi-select" ||
          field.multiple === true;
        const choice =
          options.length > 0 &&
          (multiple ||
            field.type === "select" ||
            field.type === "radio" ||
            field.type === "choice");
        if (field.type === "boolean" || field.type === "checkbox") {
          return (
            <label key={key} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                disabled={readOnly}
                checked={value === true}
                onChange={(event) => setValue(key, event.target.checked)}
              />
              {label}
            </label>
          );
        }
        if (choice) {
          const selected = Array.isArray(value) ? value : [];
          return (
            <fieldset key={key} className="flex flex-col gap-1 text-xs">
              <legend className="mb-1">{label}</legend>
              <div className="flex flex-col gap-1">
                {options.map((option, index) => {
                  const optionValue =
                    option && typeof option === "object"
                      ? (option.value ?? option.name ?? option.label)
                      : option;
                  const optionLabel =
                    option && typeof option === "object"
                      ? (option.label ?? option.name ?? optionValue)
                      : option;
                  const checked = multiple
                    ? selected.some(
                        (entry) => String(entry) === String(optionValue),
                      )
                    : String(value ?? "") === String(optionValue);
                  return (
                    <label
                      key={`${key}:${optionValue}:${index}`}
                      className="flex items-center gap-2"
                    >
                      <input
                        type={multiple ? "checkbox" : "radio"}
                        name={`${form.id ?? "form"}:${key}`}
                        className={
                          multiple
                            ? "checkbox checkbox-sm"
                            : "radio radio-sm"
                        }
                        disabled={readOnly}
                        checked={checked}
                        onChange={(event) => {
                          if (!multiple) {
                            setValue(key, optionValue);
                            return;
                          }
                          setValue(
                            key,
                            event.target.checked
                              ? [
                                  ...selected.filter(
                                    (entry) =>
                                      String(entry) !== String(optionValue),
                                  ),
                                  optionValue,
                                ]
                              : selected.filter(
                                  (entry) =>
                                    String(entry) !== String(optionValue),
                                ),
                          );
                        }}
                      />
                      <span>{optionLabel}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        }
        if (field.type === "external") {
          return (
            <p key={key} className="text-xs text-warning">
              {t("agents.tools.unsupported_field", { field: label })}
            </p>
          );
        }
        if (field.type === "textarea") {
          return (
            <label key={key} className="flex flex-col gap-1 text-xs">
              <span>{label}</span>
              <textarea
                disabled={readOnly}
                value={value ?? ""}
                onChange={(event) => setValue(key, event.target.value)}
                placeholder={field.placeholder}
                rows={field.rows ?? 3}
                className="textarea textarea-bordered w-full"
              />
            </label>
          );
        }
        return (
          <label key={key} className="flex flex-col gap-1 text-xs">
            <span>{label}</span>
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
                  key,
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
