import { useTranslation } from "react-i18next";
import { TriangleAlert, Undo2 } from "lucide-react";

/**
 * The card a model's proposed change is accepted through.
 *
 * The Meta chat and the Arcana chat show the same control, because both work the
 * same way: the model may only *propose* a mutation, and the user's click is
 * what applies it. One card lists every proposal of the message, and the same
 * button applies them all; after that it offers to revert them where the caller
 * captured enough state to undo.
 *
 * The caller owns the rows and the apply/revert functions. `rows` are
 * `{ key, icon, text }`, where `icon` is a lucide component rendered at 12 px.
 * `preview` is extra content below the rows (the Meta chat's agent prompt).
 * Every label defaults to the Meta chat's wording, so the two cards cannot drift
 * apart; a caller with a more precise label passes it.
 */
export default function ApprovalCard({
  rows = [],
  warning,
  preview = null,
  error = "",
  applied = false,
  reversible = true,
  applying = false,
  reverting = false,
  title,
  appliedLabel,
  acceptLabel,
  applyingLabel,
  revertLabel,
  revertingLabel,
  onAccept,
  onRevert,
  acceptGuide,
}) {
  const { t } = useTranslation();

  return (
    <div className="rounded-lg border border-warning/40 bg-warning/10 p-2.5">
      <div className="flex items-start gap-1.5">
        <TriangleAlert
          size={16}
          className="mt-0.5 shrink-0 text-warning"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-base-content">
            {title ?? t("meta_chat.proposed_changes")}
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-base-content/70">
            {warning ?? t("meta_chat.mutation_warning")}
          </p>

          <ul className="mt-1.5 space-y-0.5 text-[11px] leading-snug text-base-content">
            {rows.map((row) => {
              const Icon = row.icon ?? TriangleAlert;
              return (
                <li key={row.key} className="flex items-start gap-1.5">
                  <Icon
                    size={12}
                    className="mt-0.5 shrink-0 text-warning"
                    aria-hidden="true"
                  />
                  <span>{row.text}</span>
                </li>
              );
            })}
          </ul>

          {preview}

          {error && <p className="mt-1.5 text-[11px] text-error">{error}</p>}

          <div className="mt-2 flex justify-end gap-1.5">
            {applied && !reversible ? (
              <span className="text-[11px] text-base-content/60">
                {appliedLabel ?? t("meta_chat.applied_not_reversible")}
              </span>
            ) : applied ? (
              <button
                type="button"
                className="btn btn-ghost btn-xs gap-1.5"
                onClick={onRevert}
                disabled={reverting}
              >
                <Undo2 size={14} aria-hidden="true" />
                {reverting
                  ? revertingLabel ?? t("meta_chat.reverting")
                  : revertLabel ?? t("meta_chat.revert_changes")}
              </button>
            ) : (
              <button
                type="button"
                data-guide={acceptGuide}
                className="btn btn-warning btn-xs gap-1.5"
                onClick={onAccept}
                disabled={applying}
              >
                <TriangleAlert size={14} aria-hidden="true" />
                {applying
                  ? applyingLabel ?? t("meta_chat.applying_changes")
                  : acceptLabel ?? t("meta_chat.accept_changes")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
