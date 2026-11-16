// "Access storage" is the master switch for every tool that touches the user's files.
//
// It is stored as `tools.browser_storage` (the old name, kept so existing chats, exports and the
// Meta chat keep working). It is on unless the conversation turned it off explicitly: the old
// opt-in default stored `false` for every chat, and the Dexie v17 upgrade rewrites those rows to
// `true`, so an explicit `false` now always means the user switched it off.
export const storageAccessEnabled = (settings: any): boolean =>
  settings?.tools?.browser_storage !== false;

/**
 * The `createTools` options for a turn. With access storage off no file tool may be offered, not
 * even through an attached workspace or a mounted folder; writing stays opt-in otherwise.
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
      ...(attachedWorkspace ? { write_access: true } : {}),
    },
    hasLocalFolder: attachedWorkspace || hasMounts,
  };
};
