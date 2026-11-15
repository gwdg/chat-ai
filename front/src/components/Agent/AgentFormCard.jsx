import { useState } from "react";
import { useTranslation } from "react-i18next";

const optionInfo = (option) => {
  if (option && typeof option === "object") {
    const value = option.value ?? option.name ?? option.label;
    return {
      value,
      label: option.label ?? option.name ?? value,
      description: option.description ?? "",
    };
  }
  return { value: option, label: option, description: "" };
};

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
        const choice = options.length > 0;
        if (field.type === "boolean" || field.type === "checkbox") {
          return (
            <div key={key} className="text-xs">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  disabled={readOnly}
                  checked={value === true}
                  onChange={(event) => setValue(key, event.target.checked)}
                />
                {label}
              </label>
              {field.description && (
                <p className="ml-6 text-base-content/60">{field.description}</p>
              )}
            </div>
          );
        }
        if (field.type === "external") {
          return (
            <p key={key} className="text-xs text-warning">
              {t("agents.tools.unsupported_field", { field: label })}
            </p>
          );
        }
        if (choice) {
          const selected = Array.isArray(value) ? value : [];
          const entries = options.map(optionInfo);
          const optionValues = new Set(
            entries.map((entry) => String(entry.value)),
          );
          const customValue = (() => {
            if (!field.custom) return "";
            if (multiple) {
              return (
                selected.find(
                  (entry) => !optionValues.has(String(entry)),
                ) ?? ""
              );
            }
            if (
              value === undefined ||
              value === null ||
              optionValues.has(String(value))
            ) {
              return "";
            }
            return String(value);
          })();
          const setCustomValue = (next) => {
            if (!multiple) {
              setValue(key, next);
              return;
            }
            const base = selected.filter((entry) =>
              optionValues.has(String(entry)),
            );
            setValue(key, next ? [...base, next] : base);
          };
          return (
            <fieldset key={key} className="flex flex-col gap-1 text-xs">
              <legend className="mb-1">{label}</legend>
              {field.description && (
                <p className="mb-1 text-base-content/60">{field.description}</p>
              )}
              <div className="flex flex-col gap-1">
                {entries.map((option, index) => {
                  const checked = multiple
                    ? selected.some(
                        (entry) => String(entry) === String(option.value),
                      )
                    : String(value ?? "") === String(option.value);
                  return (
                    <label
                      key={`${key}:${option.value}:${index}`}
                      className="flex items-start gap-2"
                    >
                      <input
                        type={multiple ? "checkbox" : "radio"}
                        name={`${form.id ?? "form"}:${key}`}
                        className={`mt-0.5 ${
                          multiple ? "checkbox checkbox-sm" : "radio radio-sm"
                        }`}
                        disabled={readOnly}
                        checked={checked}
                        onChange={(event) => {
                          if (!multiple) {
                            setValue(key, option.value);
                            return;
                          }
                          setValue(
                            key,
                            event.target.checked
                              ? [
                                  ...selected.filter(
                                    (entry) =>
                                      String(entry) !== String(option.value),
                                  ),
                                  option.value,
                                ]
                              : selected.filter(
                                  (entry) =>
                                    String(entry) !== String(option.value),
                                ),
                          );
                        }}
                      />
                      <span className="min-w-0">
                        <span className="block">{option.label}</span>
                        {option.description && (
                          <span className="block text-[11px] text-base-content/60">
                            {option.description}
                          </span>
                        )}
                      </span>
                    </label>
                  );
                })}
                {field.custom && (
                  <label className="mt-1 flex flex-col gap-1">
                    <span className="text-base-content/60">
                      {t("agents.form_custom_answer")}
                    </span>
                    <input
                      type="text"
                      disabled={readOnly}
                      value={customValue}
                      onChange={(event) => setCustomValue(event.target.value)}
                      placeholder={t("agents.form_custom_answer")}
                      className="input input-bordered input-sm w-full"
                    />
                  </label>
                )}
              </div>
            </fieldset>
          );
        }
        if (field.type === "textarea") {
          return (
            <label key={key} className="flex flex-col gap-1 text-xs">
              <span>{label}</span>
              {field.description && (
                <span className="text-base-content/60">{field.description}</span>
              )}
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
            {field.description && (
              <span className="text-base-content/60">{field.description}</span>
            )}
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
