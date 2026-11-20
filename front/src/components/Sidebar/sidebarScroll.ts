/**
 * The sidebar list belongs to every page (chat, topic, workspace, meta, agent)
 * and each page mounts its own copy, so the offset has to outlive the component:
 * without it, opening a topic or workspace row navigates to a page whose new
 * sidebar starts at the first entry, and the list visibly jumps while the page
 * swaps.
 *
 * The memory is module state on purpose: it must survive the unmount, but a
 * reload should still start at the top again.
 */
let rememberedOffset = 0;

/**
 * Rows and section padding differ by a few pixels between pages (an active row,
 * a draft chat). An offset that is only this much past the end still means "the
 * bottom the user was looking at", so the list lands there instead of staying at
 * the top forever because its new height is 4 px short.
 */
const RESTORE_TOLERANCE_PX = 64;

/** Store the list's current offset, called from the container's scroll handler. */
export function rememberSidebarScroll(container: HTMLElement | null): void {
  if (container) rememberedOffset = container.scrollTop;
}

/**
 * Apply the remembered offset and report whether there is nothing left to do.
 * A list whose rows are not rendered yet is far shorter than the remembered
 * offset, so the caller retries on the next render instead of clamping to
 * whatever is currently reachable and losing the place.
 */
export function restoreSidebarScroll(container: HTMLElement | null): boolean {
  if (!container) return false;
  if (rememberedOffset <= 0) return true;
  const maxOffset = container.scrollHeight - container.clientHeight;
  if (maxOffset < rememberedOffset - RESTORE_TOLERANCE_PX) return false;
  container.scrollTop = Math.min(rememberedOffset, Math.max(0, maxOffset));
  return true;
}

/** Only for tests: forget the offset between specs. */
export function resetSidebarScrollMemory(): void {
  rememberedOffset = 0;
}
