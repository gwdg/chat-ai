import { useTranslation } from "react-i18next";
import { AlertCircle, ChevronLeft, Loader2, Save } from "lucide-react";

type ArcanaMarkdownEditorProps = {
  /** The file being edited, as the collection stores it. */
  name: string;
  value: string;
  loading?: boolean;
  saving?: boolean;
  error?: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
};

/**
 * One file's Markdown, edited inside the collection's right-hand panel.
 *
 * It is deliberately not a dialog: the page already has one panel for its
 * files, and a modal over the chat would hide the collection it edits. The
 * editor takes the panel over until it is closed, and the save path belongs to
 * `ArcanaManager` because it has to write through the provider and reindex.
 *
 * Saving keeps the uploaded file: saia-rag replaces the text its chunks point
 * into, so a converted PDF or Word document is not turned into a `.md` file.
 * The hint says that, because losing the original would otherwise be the
 * obvious reading of "save the Markdown".
 */
export default function ArcanaMarkdownEditor({
  name,
  value,
  loading = false,
  saving = false,
  error,
  onChange,
  onSave,
  onClose,
}: ArcanaMarkdownEditorProps) {
  const { t } = useTranslation();

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-2"
      data-guide="arcana-markdown-editor"
      data-file={name}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-base-300 pb-2">
        <button
          type="button"
          className="btn btn-ghost btn-xs btn-square"
          onClick={onClose}
          disabled={saving}
          title={t("arcanas.markdown_close")}
          aria-label={t("arcanas.markdown_close")}
        >
          <ChevronLeft size={14} />
        </button>
        <span
          className="min-w-0 flex-1 truncate text-xs font-semibold text-base-content"
          title={name}
        >
          {name}
        </span>
        <button
          type="button"
          data-guide="arcana-markdown-save"
          className="btn btn-primary btn-xs gap-1"
          onClick={onSave}
          disabled={loading || saving}
          title={t("arcanas.markdown_save")}
        >
          {saving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Save size={14} />
          )}
          {t("arcanas.markdown_save")}
        </button>
      </div>

      <p className="text-[11px] leading-relaxed text-base-content/60">
        {t("arcanas.markdown_reindex_hint", { name })}
      </p>

      {error && (
        <div className="flex items-start gap-1.5 rounded-lg bg-error/10 px-2 py-1.5 text-xs text-error">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span className="min-w-0 break-words">{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-xs text-base-content/60">
          <Loader2 size={14} className="animate-spin" />
          {t("arcanas.markdown_loading")}
        </div>
      ) : (
        <textarea
          className="textarea textarea-bordered min-h-0 w-full flex-1 resize-none font-mono text-xs leading-relaxed"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          spellCheck={false}
          aria-label={t("arcanas.markdown_editor_label", { name })}
          data-guide="arcana-markdown-input"
        />
      )}
    </div>
  );
}
