import { GitError } from "./repo";

/**
 * Every Git failure is shown through here: known codes get a translated
 * sentence, everything else keeps the library's own message, which is usually
 * the only thing that explains a rejected remote.
 */
export const gitErrorText = (
  error: unknown,
  t: (key: string, options?: Record<string, unknown>) => string,
): string => {
  const raw =
    error instanceof Error ? error.message : String(error ?? "").trim();
  if (error instanceof GitError) {
    return t(`workspace.git.error.${error.code.toLowerCase()}`, {
      defaultValue: raw || error.code,
    });
  }
  if (!raw) return t("workspace.git.error.generic");
  return raw;
};

export const gitErrorCode = (error: unknown): string | null =>
  error instanceof GitError ? error.code : null;
