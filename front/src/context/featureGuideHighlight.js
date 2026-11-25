/**
 * Visibility helper for the feature-guide highlight.
 *
 * The guide draws a ring around the element a step points at. On phones the
 * sidebar is an overlay drawer: while it is open it covers the conversation,
 * and a step that targets something in the conversation (for example the
 * tutorial catalog button) would paint its ring on top of the drawer instead of
 * on the target. The ring then appears to point at whatever the drawer shows
 * underneath it, which is wrong.
 *
 * `isTargetCovered` reports that case so the caller can skip the highlight. It
 * also reports targets outside the viewport, which happens when a target lives
 * in the closed drawer.
 */

const defaultElementFromPoint = () =>
  typeof document !== "undefined" &&
  typeof document.elementFromPoint === "function"
    ? document.elementFromPoint.bind(document)
    : undefined;

export function isTargetCovered(target, rect, options = {}) {
  if (!target || !rect || rect.width <= 0 || rect.height <= 0) return false;

  const elementFromPoint =
    options.elementFromPoint ?? defaultElementFromPoint();
  // Without hit testing (for example in a non-browser test) assume the target
  // is reachable instead of hiding every highlight.
  if (typeof elementFromPoint !== "function") return false;

  const viewportWidth =
    options.viewportWidth ??
    (typeof window !== "undefined" ? window.innerWidth : 0);
  const viewportHeight =
    options.viewportHeight ??
    (typeof window !== "undefined" ? window.innerHeight : 0);

  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  if (x < 0 || y < 0 || x > viewportWidth || y > viewportHeight) return true;

  const hit = elementFromPoint(x, y);
  if (!hit) return false;

  // A child of the target can sit under the centre point (an icon or label);
  // that still means the target itself is on top.
  return !(hit === target || target.contains(hit));
}

/**
 * Pick the element a step should point at when a selector matches several
 * copies. The sidebar keeps a compact rail and an expanded panel with the same
 * user-settings button, so the first copy is usually behind the other one; the
 * ring would hide (it is covered) and the step's click completion listens on an
 * element the user cannot reach. The first reachable copy wins.
 *
 * When every copy is covered — a target below the fold, for example — the first
 * one is returned so the caller can still scroll it into view.
 */
export function selectGuideTarget(candidates, isCovered = () => false) {
  const list = Array.from(candidates ?? []).filter(Boolean);
  return list.find((candidate) => !isCovered(candidate)) ?? list[0] ?? null;
}
