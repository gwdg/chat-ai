import type { Extension } from "@codemirror/state";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";

const mono =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

/**
 * The editor wears the app's daisyUI colours instead of a bundled theme, so it
 * follows dark mode and a brand's palette without a second stylesheet.
 */
export const editorTheme: Extension = EditorView.theme({
  "&": {
    height: "100%",
    backgroundColor: "transparent",
    color: "var(--color-base-content)",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    fontFamily: mono,
    fontSize: "13px",
    lineHeight: "1.55",
    overflow: "auto",
  },
  ".cm-content": {
    padding: "12px 0",
    caretColor: "var(--color-primary)",
  },
  ".cm-line": { padding: "0 12px" },
  ".cm-gutters": {
    backgroundColor: "transparent",
    color: "var(--color-base-content)",
    border: "none",
    opacity: "0.45",
  },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 8px 0 12px" },
  ".cm-activeLine": {
    backgroundColor:
      "color-mix(in oklab, var(--color-base-200) 65%, transparent)",
  },
  ".cm-activeLineGutter": { backgroundColor: "transparent" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor:
      "color-mix(in oklab, var(--color-primary) 22%, transparent) !important",
  },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--color-primary)" },
  ".cm-panels": {
    backgroundColor: "var(--color-base-100)",
    color: "var(--color-base-content)",
  },
  ".cm-searchMatch": {
    backgroundColor:
      "color-mix(in oklab, var(--color-warning) 35%, transparent)",
  },
  ".cm-searchMatch.cm-searchMatch-selected": {
    backgroundColor:
      "color-mix(in oklab, var(--color-warning) 60%, transparent)",
  },
  ".cm-matchingBracket": {
    backgroundColor:
      "color-mix(in oklab, var(--color-accent) 25%, transparent)",
    outline: "none",
  },
  ".cm-foldPlaceholder": {
    backgroundColor: "var(--color-base-200)",
    border: "none",
    color: "var(--color-base-content)",
  },
  ".cm-tooltip": {
    backgroundColor: "var(--color-base-100)",
    border: "1px solid var(--color-base-300)",
    color: "var(--color-base-content)",
  },
});

/** Token colours, mapped onto the same semantic palette the rest of the UI uses. */
export const editorHighlighting: Extension = syntaxHighlighting(
  HighlightStyle.define([
    {
      tag: [t.keyword, t.moduleKeyword, t.controlKeyword, t.operatorKeyword],
      color: "var(--color-secondary)",
    },
    {
      tag: [
        t.comment,
        t.lineComment,
        t.blockComment,
        t.docComment,
        t.processingInstruction,
      ],
      color: "var(--color-base-content)",
      opacity: "0.55",
    },
    {
      tag: [t.string, t.special(t.string), t.inserted],
      color: "var(--color-success)",
    },
    {
      tag: [t.number, t.integer, t.float, t.bool, t.atom, t.null],
      color: "var(--color-info)",
    },
    {
      tag: [
        t.function(t.variableName),
        t.function(t.propertyName),
        t.labelName,
      ],
      color: "var(--color-accent)",
    },
    {
      tag: [t.typeName, t.className, t.namespace, t.definitionKeyword],
      color: "var(--color-warning)",
    },
    {
      tag: [t.propertyName, t.attributeName],
      color: "var(--color-primary)",
    },
    { tag: [t.variableName, t.name], color: "var(--color-base-content)" },
    {
      tag: [t.operator, t.punctuation, t.separator, t.bracket],
      color: "var(--color-base-content)",
    },
    {
      tag: [t.meta, t.annotation],
      color: "var(--color-base-content)",
      opacity: "0.7",
    },
    {
      tag: [t.regexp, t.escape],
      color: "var(--color-error)",
    },
    {
      tag: [t.link, t.url],
      color: "var(--color-info)",
      textDecoration: "underline",
    },
    { tag: t.heading, color: "var(--color-primary)", fontWeight: "bold" },
    { tag: t.strong, fontWeight: "bold" },
    { tag: t.emphasis, fontStyle: "italic" },
    { tag: t.strikethrough, textDecoration: "line-through" },
    { tag: t.invalid, color: "var(--color-error)" },
  ]),
);
