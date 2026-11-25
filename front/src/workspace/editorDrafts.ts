/**
 * Unsaved editor text, kept for the life of the tab.
 *
 * A draft is keyed by workspace, source and provider path, so clicking another
 * file in the tree — or another workspace's tree — never throws the text away.
 * Nothing is persisted: a reload drops every draft, which is why the tree shows
 * a dot on a file that still has one.
 */
export type EditorDraft = {
  /** What the editor holds now. */
  text: string;
  /** What the provider last confirmed (the loaded text, or the last save). */
  base: string;
};

const drafts = new Map<string, EditorDraft>();
const listeners = new Set<() => void>();
let version = 0;

function emit() {
  version += 1;
  for (const listener of listeners) listener();
}

/** The identity of one file in one source; never a display path, which a mount can alias. */
export function editorDraftKey(
  workspaceId: string | undefined,
  sourceId: string | undefined,
  path: string | undefined,
): string {
  return `${workspaceId ?? ""}|${sourceId ?? ""}|${path ?? ""}`;
}

export function getEditorDraft(key: string): EditorDraft | undefined {
  return drafts.get(key);
}

export function hasEditorDraft(key: string): boolean {
  return drafts.has(key);
}

/**
 * Stores the current text and tells subscribers only when a file gains or loses
 * its dot — a keystroke in an already dirty file redraws nothing but the editor.
 */
export function setEditorDraft(key: string, draft: EditorDraft) {
  const existed = drafts.has(key);
  if (draft.text === draft.base) drafts.delete(key);
  else drafts.set(key, draft);
  if (existed !== drafts.has(key)) emit();
}

export function clearEditorDraft(key: string) {
  if (drafts.delete(key)) emit();
}

export function subscribeEditorDrafts(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function editorDraftsVersion(): number {
  return version;
}

/** Test helper: a fresh session starts without drafts. */
export function resetEditorDrafts() {
  if (drafts.size === 0) return;
  drafts.clear();
  emit();
}
