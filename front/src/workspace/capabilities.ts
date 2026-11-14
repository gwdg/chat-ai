import type { SourceKind, WorkspaceCapabilities } from "../db/dbTypes";

export const FULL_CAPABILITIES: WorkspaceCapabilities = {
  read: true,
  write: true,
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
  delete: false,
  mkdir: false,
  rename: false,
  move: false,
  copy: false,
};

export function defaultCapabilities(kind: SourceKind): WorkspaceCapabilities {
  if (kind === "browser") {
    return {
      ...FULL_CAPABILITIES,
      quota: true,
      watch: true,
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
  if (kind === "arcana") {
    return {
      ...FULL_CAPABILITIES,
      mkdir: false,
      rename: false,
      move: true,
      copy: true,
      serverSideMove: false,
      serverSideCopy: false,
      quota: true,
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
