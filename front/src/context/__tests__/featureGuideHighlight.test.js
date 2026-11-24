import { describe, expect, it } from "vitest";

import { isTargetCovered, selectGuideTarget } from "../featureGuideHighlight";

const rect = { left: 40, top: 100, width: 120, height: 30 };

const options = (hit, overrides = {}) => ({
  elementFromPoint: () => hit,
  viewportWidth: 412,
  viewportHeight: 839,
  ...overrides,
});

describe("isTargetCovered", () => {
  it("accepts a hit on the target itself", () => {
    const target = { contains: () => false };
    expect(isTargetCovered(target, rect, options(target))).toBe(false);
  });

  it("accepts a hit on a child of the target", () => {
    const icon = {};
    const target = { contains: (node) => node === icon };
    expect(isTargetCovered(target, rect, options(icon))).toBe(false);
  });

  it("reports a different element on top of the target", () => {
    // An open sidebar drawer covers the conversation on phones: the hit is a
    // drawer button, not the guide target behind it.
    const drawerButton = {};
    const target = { contains: () => false };
    expect(isTargetCovered(target, rect, options(drawerButton))).toBe(true);
  });

  it("reports a target outside the viewport", () => {
    const target = { contains: () => false };
    const offscreen = { left: -300, top: 100, width: 120, height: 30 };
    expect(isTargetCovered(target, offscreen, options(target))).toBe(true);
  });

  it("does not hide the highlight without hit testing", () => {
    const target = { contains: () => false };
    expect(
      isTargetCovered(target, rect, {
        viewportWidth: 412,
        viewportHeight: 839,
        elementFromPoint: undefined,
      }),
    ).toBe(false);
  });

  it("ignores elements without a measurable rect", () => {
    const target = { contains: () => false };
    expect(
      isTargetCovered(
        target,
        { left: 0, top: 0, width: 0, height: 0 },
        options(target),
      ),
    ).toBe(false);
  });
});

describe("selectGuideTarget", () => {
  it("returns null when nothing matches", () => {
    expect(selectGuideTarget([])).toBeNull();
    expect(selectGuideTarget(undefined)).toBeNull();
  });

  it("skips a covered copy of the same control", () => {
    // The rail's user button sits behind the expanded sidebar panel.
    const rail = { id: "rail" };
    const card = { id: "card" };
    const chosen = selectGuideTarget([rail, card], (node) => node === rail);
    expect(chosen).toBe(card);
  });

  it("falls back to the first copy when every one is covered", () => {
    // A target below the fold is covered too; it still has to be scrolled to.
    const below = { id: "below" };
    const covered = () => true;
    expect(selectGuideTarget([below], covered)).toBe(below);
  });
});
