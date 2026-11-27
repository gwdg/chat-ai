import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ChevronLeft,
  Close,
  Code,
  Document,
  Download,
  Edit,
  Locked,
  Save,
  Undo,
  View,
} from "@carbon/icons-react";
import { useTranslation } from "react-i18next";

import DescribeImageButton from "../DocumentPanel/DescribeImageButton";
import FilePreviewContent from "../DocumentPanel/FilePreviewContent";
import TypstDocument from "../Conversation/MessageAssistant/TypstDocument";
import { getFileType } from "../../utils/attachments";
import { formatBytes } from "../../utils/formatBytes";
import { isTypstFileName } from "../../utils/typstFiles";
import {
  clearEditorDraft,
  getEditorDraft,
  setEditorDraft,
} from "../../workspace/editorDrafts";

// CodeMirror is the heaviest thing the file browser can load — core plus the
// grammar a file asks for — so it arrives in its own chunk the first file that
// needs it, never with the workspace page.
const WorkspaceCodeEditor = lazy(() => import("./WorkspaceCodeEditor"));

const noop = () => {};

/**
 * The Preview tab. It opens read-only: media and rendered documents through the
 * shared preview body, text and code as a highlighted CodeMirror that cannot be
 * typed into. An editable file additionally offers Edit beside Preview, and only
 * there does the text become a document with Save and Revert behind it.
 */
export default function WorkspacePreviewTab({
  preview,
  onClose,
  onDownload,
  showPdfHint = false,
  resetKey,
  onBack,
}) {
  const { t } = useTranslation();
  const entry = preview.entry;
  // `key` is the request's identity and already drove this component's remount;
  // spreading the request into the preview body would hand React a second one.
  const { key: _requestKey, typst, ...previewContent } = preview;
  const errorText = preview.tooLarge
    ? t("workspace.preview_too_large")
    : preview.error;
  const limitLabel =
    preview.tooLarge && typeof preview.limitBytes === "number"
      ? formatBytes(preview.limitBytes)
      : undefined;
  // One identity for the content: `key` remounts it (and drops the previous
  // file's failed-media state), `resetKey` resets that state as well. The
  // request's own `key` is bookkeeping for the Preview tab, never a prop, so it
  // is passed here directly instead of travelling inside a spread.
  const contentKey = resetKey ?? preview.key ?? entry.name;
  const editor = preview.editor ?? null;
  const fileType = getFileType({ type: entry.mime, name: entry.name });
  // HTML is its own preview even though `getFileType` calls it code.
  const isHtml =
    entry.mime?.startsWith("text/html") === true ||
    /\.(html?|xhtml)$/i.test(entry.name ?? "");
  const hasRendered =
    isHtml || fileType === "markdown" || fileType === "csv";
  // A Typst file is source like any other code file, and rendering is an offer on
  // top of it rather than a preference: the user asked for it for this file.
  const isTypst = isTypstFileName(entry.name, entry.mime);
  // Preview is the way in, never the editor: reading a file must not be one
  // keystroke away from changing it. The tab is remounted per preview request,
  // so the mode starts over for every file.
  const [mode, setMode] = useState("preview");
  const [renderTypst, setRenderTypst] = useState(false);
  // Unsaved text survives switching files, so a re-opened file comes back with it.
  const [text, setText] = useState(() => {
    const draft = editor ? getEditorDraft(editor.draftKey) : undefined;
    return draft ? draft.text : (preview.text ?? "");
  });
  const [base, setBase] = useState(() => {
    const draft = editor ? getEditorDraft(editor.draftKey) : undefined;
    return draft ? draft.base : (preview.text ?? "");
  });
  const [size, setSize] = useState(entry.size);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const savingRef = useRef(false);

  // The request can gain an editor after this pane mounted (the tree asks for a
  // spinner first, then sends the bytes). Adopt its text then, or the editor
  // would open empty over a file that has content.
  const draftKey = editor?.draftKey;
  const loadedTextRef = useRef(preview.text ?? "");
  loadedTextRef.current = preview.text ?? "";
  useEffect(() => {
    if (!draftKey) return;
    const draft = getEditorDraft(draftKey);
    setText(draft ? draft.text : loadedTextRef.current);
    setBase(draft ? draft.base : loadedTextRef.current);
  }, [draftKey]);

  const isImage = fileType === "image";
  // A read-only source (a mount, a chat attachment, a provider without write)
  // has an editor but no way to save, so Edit is not offered at all.
  const canEdit = Boolean(editor) && !editor.readOnly;
  const editing = canEdit && mode === "edit";
  // Text that has no rendered form is shown as highlighted source in both modes:
  // read-only in Preview, editable in Edit.
  const codeView = Boolean(editor) && !hasRendered;
  // A file without an editor has no draft of its own: its text arrives with the
  // request (a chat attachment loads after the pane mounted), so read it there
  // instead of from the per-file state the editor keeps.
  const sourceText = editor ? text : (preview.text ?? "");
  const dirty = text !== base;
  // A Typst file renders into a pane of its own. The source stays exactly where it
  // was — read-only in Preview, editable in Edit — and the document follows the
  // text as it is typed, like `typst watch`. Rendering is therefore not a mode and
  // does not replace the editor, which is what makes it usable while editing.
  const canRenderTypst = isTypst && Boolean(sourceText?.trim());
  const showTypst = canRenderTypst && renderTypst;
  // The document only gets a source pane beside it when the file has a text view
  // to put there. A .typ file too large for the editor has none, so it shows alone.
  const splitTypst = showTypst && Boolean(editor);
  const showEditorView = codeView || editing;

  const handleChange = useCallback(
    (next) => {
      setText(next);
      // Written per keystroke so a file switch never loses it; the tree's dot
      // only repaints when the file turns dirty or clean.
      if (editor) setEditorDraft(editor.draftKey, { text: next, base });
    },
    [editor, base],
  );

  const save = useCallback(async () => {
    if (!editor?.save || savingRef.current || text === base) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError("");
    try {
      const nextSize = await editor.save(text);
      setBase(text);
      clearEditorDraft(editor.draftKey);
      if (typeof nextSize === "number") setSize(nextSize);
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [editor, text, base]);

  const revert = useCallback(() => {
    if (savingRef.current) return;
    setText(base);
    setSaveError("");
    if (editor) clearEditorDraft(editor.draftKey);
  }, [base, editor]);

  // Ctrl/Cmd+S is handled at the window so it works with the focus on the toolbar
  // too, and the browser's own save dialog never appears.
  useEffect(() => {
    if (!editing || !editor?.save) return undefined;
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editing, editor?.save, save]);

  const subtitle = [
    entry.mime,
    typeof size === "number" ? formatBytes(size) : undefined,
  ]
    .filter(Boolean)
    .join(" · ");

  const editorView = (
    <WorkspaceCodeEditor
      key={editor?.draftKey}
      value={text}
      fileName={entry.name}
      readOnly={!editing}
      onChange={editing ? handleChange : noop}
    />
  );

  // The compiler, its consent prompt and the crop-to-content live in
  // TypstDocument, which the fenced Typst block shares. Cancelling the download
  // closes the pane instead of leaving an empty one beside the source.
  const typstPane = (
    <TypstDocument
      content={sourceText}
      resolveFile={typst?.resolveFile}
      onDecline={() => setRenderTypst(false)}
      zoomable
    />
  );

  const editorFallback = (
    <div className="flex h-full items-center justify-center text-xs text-base-content/50">
      {t("common.loading")}
    </div>
  );

  return (
    <section
      data-guide="workspace-preview-panel"
      data-editing={editing ? "true" : "false"}
      data-read-only={editor?.readOnly ? "true" : "false"}
      className="flex min-h-0 flex-1 flex-col"
    >
      {/* Same header as the docked file preview a regular chat opens, so a file
          looks the same whether it sits in this tab or beside a chat. */}
      <div className="flex items-center gap-2 border-b border-base-300 px-3 py-2.5">
        {onBack && (
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-square shrink-0"
            data-guide="workspace-preview-back"
            title={t("common.back")}
            aria-label={t("common.back")}
            onClick={onBack}
          >
            <ChevronLeft size={18} />
          </button>
        )}
        <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-base-200 text-accent sm:flex">
          <Document size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-1.5 truncate text-sm font-semibold">
            <span className="truncate">{entry.name}</span>
            {dirty && (
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                title={t("workspace.unsaved_changes")}
                aria-label={t("workspace.unsaved_changes")}
              />
            )}
          </h2>
          {subtitle && (
            <p className="truncate text-[11px] text-base-content/50">
              {subtitle}
            </p>
          )}
        </div>
        {editor?.readOnly && (
          <span
            data-guide="workspace-preview-read-only"
            title={t("workspace.read_only_file")}
            className="flex shrink-0 items-center gap-1 rounded-full bg-base-200 px-2 py-0.5 text-[11px] text-base-content/60"
          >
            <Locked size={12} />
            {t("workspace.read_only_badge")}
          </span>
        )}
        {canRenderTypst && (
          <button
            type="button"
            className="btn btn-ghost btn-xs shrink-0"
            data-guide="workspace-render-typst"
            aria-pressed={renderTypst}
            title={
              renderTypst
                ? t("workspace.show_source")
                : t("workspace.render_typst")
            }
            onClick={() => setRenderTypst((prev) => !prev)}
          >
            {renderTypst ? <Code size={14} /> : <Document size={14} />}
            {renderTypst
              ? t("workspace.show_source")
              : t("workspace.render_typst")}
          </button>
        )}
        {canEdit && (
          <div className="join shrink-0">
            <button
              type="button"
              className={`btn btn-xs join-item ${
                editing ? "btn-ghost" : "btn-active"
              }`}
              data-guide="workspace-preview-toggle"
              aria-pressed={!editing}
              title={t("workspace.mode_preview")}
              aria-label={t("workspace.mode_preview")}
              onClick={() => setMode("preview")}
            >
              <View size={15} />
            </button>
            <button
              type="button"
              className={`btn btn-xs join-item ${
                editing ? "btn-active" : "btn-ghost"
              }`}
              data-guide="workspace-edit-toggle"
              aria-pressed={editing}
              title={t("workspace.mode_edit")}
              aria-label={t("workspace.mode_edit")}
              onClick={() => setMode("edit")}
            >
              <Edit size={15} />
            </button>
          </div>
        )}
        {isImage && <DescribeImageButton preview={preview} />}
        {onDownload && (
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-square"
            data-guide="workspace-preview-download"
            title={t("workspace.download")}
            aria-label={t("workspace.download")}
            onClick={() => onDownload(entry)}
          >
            <Download size={18} />
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-square"
          data-guide="workspace-preview-close"
          title={t("common.close")}
          aria-label={t("common.close")}
          onClick={onClose}
        >
          <Close size={18} />
        </button>
      </div>

      {editing && editor && (
        <div className="flex flex-wrap items-center gap-2 border-b border-base-300 bg-base-200/40 px-3 py-1.5 text-[11px]">
          {dirty ? (
            <span
              className="text-base-content/70"
              data-guide="workspace-dirty"
            >
              {t("workspace.unsaved_changes")}
            </span>
          ) : (
            <span className="text-base-content/40">
              {t("workspace.no_unsaved_changes")}
            </span>
          )}
          <div className="ml-auto flex items-center gap-1">
            {dirty && (
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                data-guide="workspace-revert"
                onClick={revert}
                disabled={saving}
              >
                <Undo size={14} />
                {t("workspace.revert_changes")}
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary btn-xs"
              data-guide="workspace-save"
              onClick={() => void save()}
              disabled={!dirty || saving}
            >
              {saving ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <Save size={14} />
              )}
              {t("common.save")}
            </button>
          </div>
        </div>
      )}

      {saveError && (
        <p
          data-guide="workspace-save-error"
          className="border-b border-base-300 bg-error/10 px-3 py-1.5 text-[11px] text-error"
        >
          {t("workspace.save_failed", { message: saveError })}
        </p>
      )}

      <div
        data-guide="workspace-preview-body"
        data-rendering-typst={showTypst ? "true" : "false"}
        className={
          splitTypst
            ? "flex min-h-0 flex-1 flex-col lg:flex-row"
            : showTypst
              ? "flex min-h-0 flex-1 flex-col overflow-auto p-2"
              : showEditorView
                ? "min-h-0 flex-1 overflow-hidden"
                : "min-h-0 flex-1 overflow-auto p-4"
        }
      >
        {splitTypst ? (
          // Three panes in the file manager: the tree, this source and the document.
          // The side-by-side split only kicks in on a wide screen; on a phone the
          // document sits below the source instead of squeezing both.
          <>
            <div
              data-guide="workspace-typst-source"
              className="min-h-0 min-w-0 flex-1 overflow-hidden border-b border-base-300 lg:border-b-0 lg:border-r"
            >
              {/* One view per file: undo history, cursor and scroll belong to the
                  file that is open, and the grammar is fetched for it alone.
                  Preview and Edit share that view, so switching modes keeps the
                  position. */}
              <Suspense fallback={editorFallback}>{editorView}</Suspense>
            </div>
            <div
              data-guide="workspace-typst-panel"
              className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto p-2"
            >
              {typstPane}
            </div>
          </>
        ) : showTypst ? (
          typstPane
        ) : showEditorView ? (
          // One view per file: undo history, cursor and scroll belong to the file
          // that is open, and the grammar is fetched for it alone. Preview and
          // Edit share that view, so switching modes keeps the position.
          <Suspense fallback={editorFallback}>{editorView}</Suspense>
        ) : (
          <FilePreviewContent
            key={contentKey}
            {...previewContent}
            text={sourceText}
            error={errorText}
            showPdfHint={showPdfHint}
            resetKey={contentKey}
            onDownload={onDownload}
            downloadLabel={t("workspace.download")}
            tooLarge={preview.tooLarge === true}
            limitLabel={limitLabel}
          />
        )}
      </div>
    </section>
  );
}
