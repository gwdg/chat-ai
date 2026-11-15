// How attachments reach the model.
//
// Files are prepared under `/artefacts/<file id>/` in the conversation workspace (see
// prepare.ts). When the chat has file access, the agent reads them with its file tools and the
// prompt only lists their paths. A chat without file access gets no tools, so the app inlines the
// text of attachments that are readable as text — otherwise a text or markdown file would be
// unusable even though any chat model can read it.

/** File kinds whose bytes are plain text (see `utils/attachments.js#getFileType`). */
export const TEXT_KINDS = new Set(["text", "markdown", "csv", "code"]);

/**
 * A text file carries its own content; a pdf, docx or image only has readable text once
 * document conversion produced a `.md`/`.txt` variant next to it.
 */
export function hasReadableText(kind: string, hasTextVariant: boolean): boolean {
  return hasTextVariant || TEXT_KINDS.has(kind);
}

export interface AttachmentEntry {
  /** Workspace path the file lives at, e.g. `/artefacts/<file id>/notes.md`. */
  path: string;
  /** Original file name, used as the label of an inlined block. */
  name: string;
  /** Converted text variants next to the file, listed for the file tools. */
  variants?: string[];
  /** Extracted text, only set when the chat has no file access. */
  text?: string;
}

/** The prompt section that lists the attachments, with readable text inlined. */
export function attachmentsNote(entries: AttachmentEntry[]): string {
  if (!entries.length) return "";
  const files = `[Attached files]\n${entries
    .map(
      (entry) =>
        `- ${entry.path}${entry.variants?.length ? ` (text: ${entry.variants.join(", ")})` : ""}`,
    )
    .join("\n")}`;
  const contents = entries.flatMap((entry) => {
    const text = entry.text?.trim();
    return text ? [`<attachment name="${entry.name}">\n${text}\n</attachment>`] : [];
  });
  return `\n\n${[files, ...contents].join("\n\n")}`;
}
