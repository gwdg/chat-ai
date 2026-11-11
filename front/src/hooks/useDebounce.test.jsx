import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDebounce } from "./useDebounce";

describe("useDebounce", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("calls the latest callback once after the delay", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(({ cb }) => useDebounce(cb, 300), {
      initialProps: { cb: first },
    });
    result.current();
    vi.advanceTimersByTime(200);
    result.current();
    rerender({ cb: second });
    vi.advanceTimersByTime(299);
    expect(second).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("cancel drops and flush runs a pending call", () => {
    const cb = vi.fn();
    const { result } = renderHook(() => useDebounce(cb, 300));
    result.current();
    result.current.cancel();
    vi.advanceTimersByTime(500);
    expect(cb).not.toHaveBeenCalled();

    result.current();
    result.current.flush();
    expect(cb).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(500);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("keeps the same function across renders", () => {
    const { result, rerender } = renderHook(() => useDebounce(() => {}, 300));
    const fn = result.current;
    rerender();
    expect(result.current).toBe(fn);
  });
});
