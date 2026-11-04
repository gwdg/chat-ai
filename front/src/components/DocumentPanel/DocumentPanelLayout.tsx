import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import DocumentSidePanel, { DraftDocumentPanel, type DocumentDraft } from "./DocumentSidePanel";
import { DocumentPanelContext } from "./DocumentPanelContext";

/** Agent tools whose streamed arguments carry a whole document, and which argument holds it. */
const STREAMED_TOOLS: Record<string, string> = {
  create_docx: "markdown",
  write: "content",
};

type View = { type: "file"; fileId: string } | { type: "draft"; callId: string } | null;

/** Assistant messages still being produced; only these can open the panel on their own. */
function loadingReplies(messages: any[] | undefined): any[] {
  return (messages ?? []).filter((message) => message?.role === "assistant" && message.loading);
}

function draftsIn(reply: any): DocumentDraft[] {
  const drafts: DocumentDraft[] = [];
  for (const message of Array.isArray(reply?.meta?.agent) ? reply.meta.agent : []) {
    if (message?.role !== "assistant" || !Array.isArray(message.content)) continue;
    for (const block of message.content) {
      const field = block?.type === "toolCall" ? STREAMED_TOOLS[block.name] : undefined;
      if (!field || !block.id) continue;
      const args = block.arguments ?? {};
      const path = typeof args.path === "string" ? args.path : undefined;
      drafts.push({
        callId: block.id,
        path,
        text: typeof args[field] === "string" ? args[field] : "",
        docx: block.name === "create_docx",
      });
    }
  }
  return drafts;
}

function fileIdsIn(reply: any): string[] {
  return (Array.isArray(reply?.content) ? reply.content : [])
    .filter((item: any) => item?.type === "file" && item.fileId)
    .map((item: any) => item.fileId);
}

/**
 * Chat column plus the document side panel. Provides `useOpenDocument()` to the
 * tree. While a reply streams, a document-writing tool call opens the panel
 * with the live arguments; the stored file replaces it once the tool has run.
 */
export default function DocumentPanelLayout({
  conversationId,
  messages,
  children,
}: {
  conversationId?: string;
  messages?: any[];
  children: ReactNode;
}) {
  const [view, setView] = useState<View>(null);
  const [draft, setDraft] = useState<DocumentDraft | null>(null);
  const seenCalls = useRef(new Set<string>());
  const seenFiles = useRef(new Set<string>());

  useEffect(() => {
    setView(null);
    setDraft(null);
    seenCalls.current = new Set();
    seenFiles.current = new Set();
  }, [conversationId]);

  useEffect(() => {
    let next: View | undefined;
    for (const reply of loadingReplies(messages)) {
      for (const found of draftsIn(reply)) {
        if (!seenCalls.current.has(found.callId)) {
          seenCalls.current.add(found.callId);
          next = { type: "draft", callId: found.callId };
        }
        // Keep the open draft's text current; the last snapshot survives the reply finishing.
        if (view?.type === "draft" && view.callId === found.callId) setDraft(found);
        if (next?.type === "draft" && next.callId === found.callId) setDraft(found);
      }
      // Files are processed last, so a finished document replaces its draft.
      for (const fileId of fileIdsIn(reply)) {
        if (seenFiles.current.has(fileId)) continue;
        seenFiles.current.add(fileId);
        next = { type: "file", fileId };
      }
    }
    if (next) setView(next);
    // `view` is read to route updates, not a trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const openFile = useCallback((fileId: string) => setView({ type: "file", fileId }), []);
  const close = useCallback(() => setView(null), []);

  return (
    <DocumentPanelContext.Provider value={openFile}>
      <div className="relative flex min-h-0 min-w-0 overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
        {view?.type === "file" && <DocumentSidePanel key={view.fileId} fileId={view.fileId} onClose={close} />}
        {view?.type === "draft" && draft?.callId === view.callId && (
          <DraftDocumentPanel draft={draft} onClose={close} />
        )}
      </div>
    </DocumentPanelContext.Provider>
  );
}
