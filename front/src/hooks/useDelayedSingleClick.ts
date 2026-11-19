import { useCallback, useEffect, useRef } from "react";

/**
 * How long a row waits for a second click before treating the first one as a
 * single click.
 */
export const DELAYED_SINGLE_CLICK_MS = 300;

/**
 * Lets one row offer a single-click action and a double-click action when the
 * single-click action would unmount the row — for example navigating to a page
 * that renders its own sidebar. The action runs after a short pause unless a
 * second click (or the double-click handler) cancels it first.
 *
 * The timer belongs to the list, not to a row: clicking another row before the
 * pause ends replaces the pending action instead of firing both.
 */
export function useDelayedSingleClick() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => cancel, [cancel]);

  const schedule = useCallback(
    (action: () => void) => {
      cancel();
      timer.current = setTimeout(() => {
        timer.current = null;
        action();
      }, DELAYED_SINGLE_CLICK_MS);
    },
    [cancel],
  );

  return { schedule, cancel };
}
