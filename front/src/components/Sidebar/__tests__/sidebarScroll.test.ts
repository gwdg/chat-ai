import { beforeEach, describe, expect, it } from "vitest";

import {
  rememberSidebarScroll,
  resetSidebarScrollMemory,
  restoreSidebarScroll,
} from "../sidebarScroll";

// jsdom does not lay elements out, so the helpers get a plain stand-in with only
// the three members they read and write.
const makeList = ({
  scrollTop = 0,
  scrollHeight = 0,
  clientHeight = 0,
} = {}) =>
  ({
    scrollTop,
    scrollHeight,
    clientHeight,
  }) as unknown as HTMLElement;

beforeEach(() => {
  resetSidebarScrollMemory();
});

describe("sidebar scroll memory", () => {
  it("restores the offset the previous sidebar left behind", () => {
    const previous = makeList({
      scrollHeight: 2_000,
      clientHeight: 800,
      scrollTop: 640,
    });
    rememberSidebarScroll(previous);

    const next = makeList({ scrollHeight: 2_000, clientHeight: 800 });
    expect(restoreSidebarScroll(next)).toBe(true);
    expect(next.scrollTop).toBe(640);
  });

  it("treats an offset a few pixels past the end as the same place", () => {
    rememberSidebarScroll(
      makeList({ scrollHeight: 2_000, clientHeight: 800, scrollTop: 1_200 }),
    );

    // The next page renders the same list 4 px shorter (an active row, a draft
    // chat), so the exact offset is no longer reachable.
    const shorterList = makeList({ scrollHeight: 1_996, clientHeight: 800 });
    expect(restoreSidebarScroll(shorterList)).toBe(true);
    expect(shorterList.scrollTop).toBe(1_196);
  });

  it("waits for the list to grow instead of clamping to what is reachable", () => {
    rememberSidebarScroll(
      makeList({ scrollHeight: 2_000, clientHeight: 800, scrollTop: 640 }),
    );

    // First render: the rows are still being read from IndexedDB.
    const shortList = makeList({ scrollHeight: 400, clientHeight: 800 });
    expect(restoreSidebarScroll(shortList)).toBe(false);
    expect(shortList.scrollTop).toBe(0);

    // Rows arrived: the same offset is reachable again.
    const filledList = makeList({ scrollHeight: 2_000, clientHeight: 800 });
    expect(restoreSidebarScroll(filledList)).toBe(true);
    expect(filledList.scrollTop).toBe(640);
  });

  it("does nothing when no list was scrolled yet", () => {
    const list = makeList({ scrollHeight: 2_000, clientHeight: 800, scrollTop: 0 });

    expect(restoreSidebarScroll(list)).toBe(true);
    expect(list.scrollTop).toBe(0);
  });

  it("reports a missing container as unfinished", () => {
    rememberSidebarScroll(makeList({ scrollHeight: 2_000, scrollTop: 640 }));

    expect(restoreSidebarScroll(null)).toBe(false);
  });

  it("keeps the newest offset when the list is scrolled again", () => {
    rememberSidebarScroll(
      makeList({ scrollHeight: 2_000, clientHeight: 800, scrollTop: 120 }),
    );
    rememberSidebarScroll(
      makeList({ scrollHeight: 2_000, clientHeight: 800, scrollTop: 480 }),
    );

    const next = makeList({ scrollHeight: 2_000, clientHeight: 800 });
    expect(restoreSidebarScroll(next)).toBe(true);
    expect(next.scrollTop).toBe(480);
  });
});
