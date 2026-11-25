import { useEffect, useRef, useState } from "react";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { basicSetup } from "codemirror";

import {
  editorLanguageFor,
  loadEditorLanguage,
} from "../../workspace/editorLanguages";
import { editorHighlighting, editorTheme } from "../../workspace/editorTheme";

type Props = {
  /** The text to show. Changing it from outside (Revert) replaces the document. */
  value: string;
  /** The file's name, which picks the grammar. */
  fileName?: string;
  readOnly?: boolean;
  /** Receives the whole document after every edit. */
  onChange: (text: string) => void;
};

/**
 * The workspace file editor: CodeMirror 6 over the file's text.
 *
 * The component is mounted per file (the Preview tab keys it by draft), so undo
 * history, scroll position and selection belong to one file. The grammar is
 * imported on demand — a Markdown file never fetches the Python parser — and the
 * theme is the app's own daisyUI palette.
 */
export default function WorkspaceCodeEditor({
  value,
  fileName,
  readOnly = false,
  onChange,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Compartments let the language and the read-only state change without
  // rebuilding the view (and losing cursor and undo history).
  const [language] = useState(() => new Compartment());
  const [editing] = useState(() => new Compartment());

  // Mount once: `value` and `readOnly` are the initial state, the effects below
  // carry every later change into the existing view.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          keymap.of([indentWithTab]),
          editorTheme,
          editorHighlighting,
          language.of([]),
          editing.of([
            EditorState.readOnly.of(readOnly),
            EditorView.editable.of(!readOnly),
          ]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString());
            }
          }),
        ],
      }),
    });
    viewRef.current = view;
    if (!readOnly) view.focus();
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Revert replaces the text under the same view, so Ctrl+Z still works.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
  }, [value]);

  useEffect(() => {
    let cancelled = false;
    void loadEditorLanguage(editorLanguageFor(fileName)).then((extension) => {
      if (cancelled || !viewRef.current) return;
      viewRef.current.dispatch({
        effects: language.reconfigure(extension),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [fileName, language]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: editing.reconfigure([
        EditorState.readOnly.of(readOnly),
        EditorView.editable.of(!readOnly),
      ]),
    });
  }, [readOnly, editing]);

  return (
    <div
      ref={hostRef}
      data-guide="workspace-editor"
      data-read-only={readOnly ? "true" : undefined}
      className="h-full min-h-0 w-full overflow-hidden bg-base-100"
    />
  );
}
