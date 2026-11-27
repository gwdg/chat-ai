import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink, FileText, Loader2 } from "lucide-react";

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
 * The pages an Arcana answer quotes.
 *
 * The card shows the passage that was used, page by page, and its click opens
 * the original file in the docked preview at that page. Reading happens on the
 * click (the helper is imported then too), so a long answer with many citations
 * does not download anything until the user asks for a document.
 */
export default function ArcanaDocumentCard({ documents = [] }) {
  const { t } = useTranslation();
  const { openFilePreview } = useFilePreview();
  const { notifyError } = useToast();
  const [opening, setOpening] = useState("");

  const open = async (document) => {
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
          const pages = splitDocumentPages(document.excerpt);
          const busy = opening === key;
          return (
            <li key={key}>
              <article className="overflow-hidden rounded-lg border border-base-300 bg-base-100">
                <button
                  type="button"
                  data-guide="arcana-document-open"
                  onClick={() => void open(document)}
                  disabled={busy}
                  className="flex w-full items-start gap-2 p-2.5 text-left transition-colors hover:bg-base-200"
                  title={t("arcana_chat.source_open")}
                >
                  <FileText
                    size={16}
                    className="mt-0.5 shrink-0 text-base-content/60"
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
                  {busy ? (
                    <Loader2
                      size={14}
                      className="mt-0.5 shrink-0 animate-spin text-base-content/60"
                      aria-hidden="true"
                    />
                  ) : (
                    <ExternalLink
                      size={14}
                      className="mt-0.5 shrink-0 text-base-content/40"
                      aria-hidden="true"
                    />
                  )}
                </button>
                <div className="max-h-52 overflow-auto border-t border-base-300/70 px-2.5 py-2">
                  {pages.length ? (
                    pages.map((block, index) => (
                      <div
                        key={`${key}-${index}`}
                        className={index ? "mt-2" : ""}
                      >
                        {block.page !== null && (
                          <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-base-content/50">
                            {t("arcana_chat.source_page", {
                              page: block.page,
                            })}
                          </p>
                        )}
                        <p className="whitespace-pre-wrap break-words text-[11px] leading-relaxed text-base-content/80">
                          {block.text}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="whitespace-pre-wrap break-words text-[11px] leading-relaxed text-base-content/80">
                      {document.excerpt}
                    </p>
                  )}
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
