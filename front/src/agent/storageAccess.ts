// "Access storage" is the master switch for every tool that touches the user's files.
//
// It is stored as `tools.browser_storage` (the old name, kept so existing chats, exports and the
// Meta chat keep working). It is on unless the conversation turned it off explicitly: the old
// opt-in default stored `false` for every chat. No migration rewrites those rows (a migration must
// never change a consent flag), so a stored `false` is respected whether it was chosen or inherited;
// only a conversation that never stored a value gets the on-by-default reading below.
export const storageAccessEnabled = (settings: any): boolean =>
  settings?.tools?.browser_storage !== false;

// Writing is always allowed in the chat's own storage. Only an attached workspace offers a switch,
// because its files are the ones the user shares; it is on unless switched off explicitly.
export const writeAccessEnabled = (
  settings: any,
  { attachedWorkspace = false }: { attachedWorkspace?: boolean } = {},
): boolean =>
  !attachedWorkspace ||
  settings?.tools?.workspace_write_access !== false;

/**
 * The `createTools` options for a turn. With access storage off no file tool may be offered, not
 * even through an attached workspace or a mounted folder. Writing is always on for the chat's own
 * storage; an attached workspace follows its `workspace_write_access` switch.
 */
export const storageToolSettings = (
  settings: any,
  {
    vision = false,
    attachedWorkspace = false,
    hasMounts = false,
  }: {
    vision?: boolean;
    attachedWorkspace?: boolean;
    hasMounts?: boolean;
  } = {},
) => {
  const enabled = storageAccessEnabled(settings);
  if (!enabled) {
    return {
      vision,
      enabled: { ...settings?.tools, browser_storage: false, write_access: false },
      hasLocalFolder: false,
    };
  }
  return {
    vision,
    enabled: {
      ...settings?.tools,
      browser_storage: true,
      write_access: writeAccessEnabled(settings, { attachedWorkspace }),
    },
    hasLocalFolder: attachedWorkspace || hasMounts,
  };
};
