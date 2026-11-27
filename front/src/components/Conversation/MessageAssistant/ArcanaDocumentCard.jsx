import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Markdown } from "@carbon/icons-react";
import { ExternalLink, Loader2 } from "lucide-react";

import { fileTypeIcon } from "../../DocumentPanel/fileTypeIcon";
import { useFilePreview } from "../../../context/FilePreviewContext";
import { useToast } from "../../../hooks/useToast";
import {
  arcanaDocumentKey,
  documentPageRange,
  splitDocumentPages,
} from "../../../utils/arcanaDocuments";

const pageLabel = (document, t) => {
  const range = documentPageRange(document);
  if (!range) return t("arcana_chat.source_text");
  if (range.from === range.to) {
    return t("arcana_chat.source_page", { page: range.from });
  }
  return t("arcana_chat.source_pages", {
    from: range.from,
    to: range.to,
  });
};

/**
 * The name the Markdown preview is shown under.
 *
 * The bytes are the indexed text, not the original upload, so the preview is a
 * `.md`. This mirrors `workspace/providers/saiaRag.ts#markdownFileName`; importing
 * it here would pull the saia-rag MCP client into the chat's own bundle.
 */
const markdownName = (name) => {
  const dot = name.lastIndexOf(".");
  return `${dot > 0 ? name.slice(0, dot) : name}.md`;
};

/**
 * The type printed beside the arrow, e.g. `PDF` or `DOCX`.
 *
 * The extension is the most recognisable label; a file without one falls back to
 * the type the preview would pick for it.
 */
const documentTypeLabel = (filename, fileType) => {
  const dot = filename.lastIndexOf(".");
  const extension = dot > 0 ? filename.slice(dot + 1) : "";
  if (/^[a-z0-9]{1,5}$/i.test(extension)) return extension.toUpperCase();
  return fileType && fileType !== "unknown" ? fileType.toUpperCase() : "";
};

/**
 * The pages an Arcana answer quotes.
 *
 * The card lists the documents, not their text: the row's Markdown icon opens the
 * cited pages as Markdown in the docked preview (the excerpt already travels in
 * the answer, so that costs no request), while the link on the right names the
 * original's type and opens the original at the cited page. Reading the original
 * happens on that click (the helper is imported then too), so a long answer with
 * many citations does not download anything until the user asks for a document.
 */
export default function ArcanaDocumentCard({ documents = [] }) {
  const { t } = useTranslation();
  const { openFilePreview } = useFilePreview();
  const { notifyError } = useToast();
  const [opening, setOpening] = useState("");

  const openMarkdown = (document) => {
    const pages = splitDocumentPages(document.excerpt);
    const text = pages.length
      ? pages
          .map((block) =>
            block.page === null
              ? block.text
              : `## ${t("arcana_chat.source_page", { page: block.page })}\n\n${block.text}`,
          )
          .join("\n\n")
      : String(document.excerpt ?? "");
    openFilePreview({
      entry: {
        name: markdownName(document.filename),
        mime: "text/markdown",
        size: text.length,
      },
      text,
    });
  };

  const openOriginal = async (document) => {
    const key = arcanaDocumentKey(document);
    if (opening) return;
    setOpening(key);
    try {
      const { openArcanaDocumentPreview } = await import(
        "../../../utils/arcanaDocumentPreview"
      );
      await openArcanaDocumentPreview({ document, openFilePreview });
    } catch (error) {
      notifyError(
        t("arcana_chat.source_failed", {
          reason: error?.message || String(error),
        }),
      );
    } finally {
      setOpening("");
    }
  };

  return (
    <section
      data-guide="arcana-documents"
      className="flex flex-col gap-1.5"
      aria-label={t("arcana_chat.sources")}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-base-content/60">
        {t("arcana_chat.sources")}
      </p>
      <ul className="flex flex-col gap-2">
        {documents.map((document) => {
          const key = arcanaDocumentKey(document);
          const busy = opening === key;
          const { type: fileType } = fileTypeIcon(document.filename);
          const typeLabel = documentTypeLabel(document.filename, fileType);
          return (
            <li key={key}>
              <article className="flex items-stretch gap-0.5 rounded-lg border border-base-300 bg-base-100 p-1">
                <button
                  type="button"
                  data-guide="arcana-document-open"
                  onClick={() => openMarkdown(document)}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-base-200"
                  title={t("arcana_chat.source_markdown_open")}
                >
                  <Markdown
                    size={16}
                    className="shrink-0 text-base-content/60"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-base-content">
                      {document.filename}
                    </span>
                    <span className="block text-[11px] text-base-content/60">
                      {pageLabel(document, t)}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  data-guide="arcana-document-original"
                  data-file-type={fileType}
                  onClick={() => void openOriginal(document)}
                  disabled={busy}
                  className="flex shrink-0 items-center gap-1 rounded-md px-2 text-[11px] font-semibold uppercase tracking-wide text-base-content/60 transition-colors hover:bg-base-200 hover:text-base-content"
                  title={t("arcana_chat.source_open")}
                  aria-label={t("arcana_chat.source_open")}
                >
                  {typeLabel}
                  {busy ? (
                    <Loader2
                      size={12}
                      className="animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <ExternalLink size={12} aria-hidden="true" />
                  )}
                </button>
              </article>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
