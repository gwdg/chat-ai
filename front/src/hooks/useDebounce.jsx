import { useMemo, useEffect, useRef } from "react";
import { debounce } from "lodash";

export function useDebounce (callback, delay) {
    const ref = useRef();

    useEffect(() => {
        ref.current = callback;
    }, [callback]);

    const debouncedCallback = useMemo(() => {
        const func = () => {
        ref.current?.();
        };

        return debounce(func, delay);
    }, []);

    return debouncedCallback;
}