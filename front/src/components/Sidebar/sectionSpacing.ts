/**
 * Vertical rhythm shared by every sidebar section band (PINNED, CHATS,
 * WORKSPACES, AGENTS, MCP SERVERS): 12px above the band and 4px under it. Each
 * band is 32px tall and carries `mb-1`, so two folded bands always sit exactly
 * 20px apart. The numbers live here so the five sections cannot drift apart one
 * class at a time.
 *
 * The chats header is the one section whose bottom pad depends on its state:
 * with the list open, the TOPICS heading directly below it supplies the space,
 * and the pad would only paint its opaque edge over that heading's hover.
 */
export const SECTION_TOP = "pt-3";
export const SECTION_BOTTOM = "pb-1";
export const SECTION_RHYTHM = `${SECTION_TOP} ${SECTION_BOTTOM}`;
