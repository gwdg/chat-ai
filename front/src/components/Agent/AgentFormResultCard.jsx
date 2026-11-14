import { useTranslation } from "react-i18next";

const displayValues = (field, value, t) => {
  if (value === undefined || value === null || value === "") {
    return [t("agents.form_not_answered")];
  }
  if (field.type === "boolean") {
    return [value ? t("agents.form_yes") : t("agents.form_no")];
  }
  if (Array.isArray(value) && value.length === 0) {
    return [t("agents.form_not_answered")];
  }
  const values = Array.isArray(value) ? value : [value];
  return values.map((entry) => {
    const option = (field.options ?? []).find(
      (candidate) => String(candidate.value) === String(entry),
    );
    return option?.label ?? String(entry);
  });
};

export default function AgentFormResultCard({ form, answers }) {
  const { t } = useTranslation();

  return (
    <div className="rounded-xl border border-success/30 bg-success/5 p-3">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-sm font-medium">
          {form.title || t("agents.form_result_title")}
        </p>
        <span className="badge badge-success badge-xs">
          {t("agents.form_submitted")}
        </span>
      </div>
      <dl className="mt-2 space-y-1 text-xs">
        {(form.fields ?? [])
          .filter((field) => !field.hidden)
          .map((field) => {
            const key = field.key ?? field.name;
            const answer = answers?.[key];
            const values = displayValues(field, answer, t);
            const isList = Array.isArray(answer) && answer.length > 0;
            return (
              <div
                key={key}
                className={isList ? "flex flex-col gap-0.5" : "flex gap-2"}
              >
                <dt className="shrink-0 text-base-content/60">
                  {field.title || field.name || key}
                </dt>
                <dd className="min-w-0 flex-1 whitespace-pre-wrap break-words text-base-content">
                  {isList ? (
                    <ul className="list-disc pl-4">
                      {values.map((entry, index) => (
                        <li key={`${key}:${entry}:${index}`}>{entry}</li>
                      ))}
                    </ul>
                  ) : (
                    values.join(", ")
                  )}
                </dd>
              </div>
            );
          })}
      </dl>
    </div>
  );
}
