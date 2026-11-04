import { createContext, useContext } from "react";

/** Opens a stored file (by fileId) in the document side panel. */
export const DocumentPanelContext = createContext<((fileId: string) => void) | null>(null);

export function useOpenDocument() {
  return useContext(DocumentPanelContext);
}
