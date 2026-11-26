import type { SourceKind, WorkspaceCapabilities } from "../db/dbTypes";

export const FULL_CAPABILITIES: WorkspaceCapabilities = {
  read: true,
  write: true,
  append: true,
  delete: true,
  mkdir: true,
  rename: true,
  move: true,
  copy: true,
  serverSideMove: false,
  serverSideCopy: false,
  quota: false,
  watch: false,
  range: true,
};

export const READ_ONLY_CAPABILITIES: WorkspaceCapabilities = {
  ...FULL_CAPABILITIES,
  write: false,
  append: false,
  delete: false,
  mkdir: false,
  rename: false,
  move: false,
  copy: false,
};

export function defaultCapabilities(kind: SourceKind): WorkspaceCapabilities {
  if (kind === "browser" || kind === "chat") {
    // A chat's own tree is OPFS like a browser source; it is watched through the chat itself, so
    // it has no change feed of its own.
    return {
      ...FULL_CAPABILITIES,
      quota: true,
      watch: kind === "browser",
      range: true,
    };
  }
  if (kind === "local") {
    return {
      ...FULL_CAPABILITIES,
      quota: false,
      watch: false,
      range: true,
    };
  }
  if (kind === "agent") {
    return {
      ...READ_ONLY_CAPABILITIES,
      quota: false,
      watch: false,
      range: true,
    };
  }
  if (kind === "arcana" || kind === "arcana-filesystem") {
    return {
      ...FULL_CAPABILITIES,
      mkdir: kind === "arcana-filesystem",
      rename: false,
      move: true,
      copy: true,
      serverSideMove: false,
      serverSideCopy: false,
      quota: kind === "arcana",
      watch: false,
      range: false,
    };
  }
  if (kind === "saia-fs") {
    // saia-fs has move/mkdir/delete and a whole-file read/write, no copy of its
    // own and no range request. `copy` stays false so the transfer planner
    // streams through read+write; `range` stays false so a preview reads the
    // complete file. The provider narrows this to the tools the server offers.
    return {
      ...FULL_CAPABILITIES,
      rename: false,
      copy: false,
      serverSideMove: false,
      serverSideCopy: false,
      quota: false,
      watch: false,
      range: false,
    };
  }
  if (kind === "saia-rag") {
    // saia-rag is a flat collection of whole files: read, write and append,
    // but no folder tree and no per-file delete/rename/move/copy. Collections
    // are created and deleted through the source browser's own actions.
    return {
      read: true,
      write: true,
      append: true,
      delete: false,
      mkdir: false,
      rename: false,
      move: false,
      copy: false,
      serverSideMove: false,
      serverSideCopy: false,
      quota: false,
      watch: false,
      range: false,
    };
  }
  return {
    ...READ_ONLY_CAPABILITIES,
    quota: false,
    watch: false,
    range: false,
  };
}
