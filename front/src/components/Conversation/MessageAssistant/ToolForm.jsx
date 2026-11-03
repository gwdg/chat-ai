import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSendMessage } from "../../../hooks/useSendMessage";

const INITIAL_VALUE = "";

function getInitialValues(fields, saved) {
  const values = {};
  for (const field of fields || []) {
    if (saved && field.name in saved) {
      values[field.name] = saved[field.name];
    } else if (field.type === "checkbox") {
      values[field.name] = field.value ?? field.default ?? false;
    } else if (field.value !== undefined) {
      values[field.name] = field.value;
    } else if (field.default !== undefined) {
      values[field.name] = field.default;
    } else {
      values[field.name] = INITIAL_VALUE;
    }
  }
  return values;
}

export default function ToolForm({ form, localState, setLocalState, onUpdate }) {
  const { t } = useTranslation();
  const sendMessage = useSendMessage();
  const fields = Array.isArray(form?.fields) ? form.fields : [];
  const [values, setValues] = useState(() =>
    getInitialValues(fields, form?.values)
  );
  // Start in editing mode unless the form was already submitted (collapsed).
  const [editing, setEditing] = useState(!form?.submitted);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setValues(getInitialValues(fields, form?.values));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form?.tool_id]);

  const updateValue = (name, value) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    onUpdate?.({ submitted: true, values });
    await sendMessage({
      localState,
      setLocalState,
      formSubmission: { tool_id: form?.tool_id, values },
    });
    setSending(false);
    setEditing(false);
  };

  const handleEdit = (e) => {
    e.preventDefault();
    // Re-open the form with the previously submitted values.
    setValues(getInitialValues(fields, form?.values));
    setEditing(true);
  };

  const handleReset = (e) => {
    e.preventDefault();
    setValues(getInitialValues(fields, null));
  };

  const fieldLabel = (field) => field.label || field.name;

  const renderInput = (field) => {
    const name = field.name;
    const value = values[name];
    const common = {
      id: `tf-${name}`,
      name,
      className:
        "w-full px-3 py-2 rounded-xl text-sm bg-base-100 " +
        "text-base-content border border-base-300 " +
        "outline-none focus:border-primary",
      required: !!field.required,
      onChange: (e) => updateValue(name, e.target.value),
      onBlur: (e) => {
        if (field.type === "number" && e.target.value !== "") {
          updateValue(name, Number(e.target.value));
        }
      },
    };

    switch (field.type) {
      case "checkbox":
        return (
          <input
            id={`tf-${name}`}
            type="checkbox"
            checked={!!value}
            onChange={(e) => updateValue(name, e.target.checked)}
            className="w-4 h-4 accent-primary cursor-pointer"
          />
        );
      case "select":
        return (
          <select {...common} value={value ?? ""}>
            {!field.options?.some((o) => String(o.value) === String(value)) && (
              <option value="">{t("tool_form.select_placeholder")}</option>
            )}
            {(field.options || []).map((opt, i) => (
              <option key={i} value={opt.value}>
                {opt.label ?? opt.value}
              </option>
            ))}
          </select>
        );
      case "textarea":
        return (
          <textarea
            {...common}
            rows={field.rows || 3}
            placeholder={field.placeholder}
            value={value ?? ""}
          />
        );
      case "number":
        return (
          <input
            {...common}
            type="number"
            min={field.min}
            max={field.max}
            step={field.step}
            placeholder={field.placeholder}
            value={value ?? ""}
          />
        );
      case "range":
        return (
          <div className="flex items-center gap-3">
            <input
              {...common}
              type="range"
              min={field.min}
              max={field.max}
              step={field.step}
              value={value ?? field.min ?? 0}
            />
            <span className="text-sm text-accent whitespace-nowrap">
              {value ?? field.min ?? 0}
            </span>
          </div>
        );
      case "radio":
        return (
          <div className="flex flex-wrap gap-3">
            {(field.options || []).map((opt, i) => (
              <label key={i} className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name={name}
                  value={opt.value}
                  checked={String(value) === String(opt.value)}
                  onChange={() => updateValue(name, opt.value)}
                  className="accent-primary cursor-pointer"
                />
                {opt.label ?? opt.value}
              </label>
            ))}
          </div>
        );
      default:
        // text, email, url, date, color, password, etc.
        return (
          <input
            {...common}
            type={field.type === "color" ? "color" : field.type === "date" ? "date" : field.type}
            placeholder={field.placeholder}
            value={value ?? ""}
          />
        );
    }
  };

  if (!editing) {
    // Collapsed: show the form as a tool call summary with an Edit button.
    return (
      <div className="w-full my-1 rounded-2xl border border-base-300 overflow-hidden">
        <div className="flex items-center justify-between gap-2 p-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-accent shrink-0">🛠</span>
            <span className="font-medium text-base-content truncate">
              {form?.title || form?.tool_id || t("tool_form.tool_call")}
            </span>
            {form?.tool_id && (
              <code className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-base-200 text-accent">
                {form.tool_id}
              </code>
            )}
          </div>
          <button
            type="button"
            onClick={handleEdit}
            className="shrink-0 px-3 py-1.5 text-sm rounded-full border border-base-300 text-base-content/70 hover:bg-base-200 cursor-pointer"
          >
            {t("tool_form.edit")}
          </button>
        </div>
        <div className="px-4 pb-3 flex flex-col gap-1">
          {fields.map((field, i) => (
            <div key={i} className="flex items-baseline gap-2 text-sm">
              <span className="text-base-content/70 shrink-0">
                {fieldLabel(field)}:
              </span>
              <span className="text-base-content break-words">
                {formatValue(field, values[field.name])}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full my-1 rounded-2xl border border-base-300 overflow-hidden"
    >
      {(form?.title || form?.description) && (
        <div className="flex flex-col gap-1 p-4">
          {form?.title && (
            <div className="font-semibold text-base-content">{form.title}</div>
          )}
          {form?.description && (
            <div className="text-sm text-base-content/70">
              {form.description}
            </div>
          )}
        </div>
      )}
      <div className="flex flex-col gap-3 px-4 pb-4">
        {fields.map((field, i) => (
          <div key={i} className="flex flex-col gap-1">
            <label
              htmlFor={`tf-${field.name}`}
              className="text-sm font-medium text-base-content"
            >
              {fieldLabel(field)}
            </label>
            {renderInput(field)}
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2 px-4 pb-4">
        <button
          type="button"
          onClick={handleReset}
          disabled={sending}
          className="px-4 py-2 text-sm rounded-full border border-base-300 text-base-content/70 hover:bg-base-200 cursor-pointer disabled:opacity-50"
        >
          {t("tool_form.reset")}
        </button>
        <button
          type="submit"
          disabled={sending}
          className="px-4 py-2 text-sm rounded-full text-white bg-primary hover:opacity-90 cursor-pointer disabled:opacity-50"
        >
          {sending ? t("tool_form.sending") : t("tool_form.submit")}
        </button>
      </div>
    </form>
  );
}

// Format a field value for the collapsed tool-call summary.
function formatValue(field, value) {
  if (field.type === "checkbox") return value ? "Yes" : "No";
  if (value === undefined || value === null || value === "") return "—";
  if (field.type === "select" || field.type === "radio") {
    const opt = (field.options || []).find((o) => String(o.value) === String(value));
    return opt?.label ?? String(value);
  }
  return String(value);
}
