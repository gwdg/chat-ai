import { useMemo, useEffect, useRef } from "react";

// Trailing-edge debounce of the latest `callback`. Like lodash's debounce, the
// returned function has `cancel()` and `flush()`, and a pending call still runs
// after the component unmounts (so a final save is not lost).
export function useDebounce(callback, delay) {
  const ref = useRef(callback);

  useEffect(() => {
    ref.current = callback;
  }, [callback]);

  return useMemo(() => {
    let timer = null;
    const run = () => {
      timer = null;
      ref.current?.();
    };
    const debounced = () => {
      clearTimeout(timer);
      timer = setTimeout(run, delay);
    };
    debounced.cancel = () => {
      clearTimeout(timer);
      timer = null;
    };
    debounced.flush = () => {
      if (timer !== null) {
        clearTimeout(timer);
        run();
      }
    };
    return debounced;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
