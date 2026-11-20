import type { TFunction } from "i18next";
import type { WorkspaceSourceRow } from "../db/dbTypes";

const NETWORK_FAILURE = /failed to fetch|networkerror|load failed|network error/i;

/**
 * A one-sentence explanation of why a source cannot be opened, or `undefined`
 * when it is healthy. Shared by the drive rail and the source browser so a
 * folder reads the same on both sides of the dialog.
 */
export function sourceProblem(
  source: WorkspaceSourceRow,
  t: TFunction,
): string | undefined {
  if (source.status !== "error" && source.status !== "needs-permission") {
    return undefined;
  }
  const detail = source.error?.trim();
  if (detail && NETWORK_FAILURE.test(detail)) {
    return t("workspace.source_browser.source_unreachable", {
      name: source.label,
    });
  }
  if (source.status === "needs-permission") {
    const base = t("workspace.source_browser.source_needs_permission", {
      name: source.label,
    });
    return detail ? `${base} ${detail}` : base;
  }
  return detail
    ? t("workspace.source_browser.source_error_detail", {
        name: source.label,
        detail,
      })
    : t("workspace.source_browser.source_broken", { name: source.label });
}

/** The first problem among several sources, for a drive that groups them. */
export function sourcesProblem(
  sources: WorkspaceSourceRow[],
  t: TFunction,
): string | undefined {
  for (const source of sources) {
    const problem = sourceProblem(source, t);
    if (problem) return problem;
  }
  return undefined;
}
