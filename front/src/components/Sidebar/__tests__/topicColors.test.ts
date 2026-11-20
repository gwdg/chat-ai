import { describe, expect, it } from "vitest";

import {
  chatRowTint,
  groupRule,
  groupRowTint,
  neutralRowTint,
  neutralRule,
  withAlpha,
} from "../topicColors";

const alphaOf = (colour: string) => Number(colour.split(", ").pop()?.replace(")", ""));

describe("chatRowTint", () => {
  it("stays weaker than the group's own wash, light and dark", () => {
    const hex = "#7C3AED";
    for (const isDark of [false, true]) {
      const group = alphaOf(groupRowTint(hex, isDark, { active: true }));
      const chat = alphaOf(chatRowTint(hex, isDark, { active: true }));
      expect(chat).toBeLessThan(group);
      // Even the resting band is stronger than an open chat's wash.
      expect(chat).toBeLessThan(alphaOf(groupRowTint(hex, isDark)));
      expect(chatRowTint(hex, isDark, { active: true })).toBe(
        withAlpha(hex, chat),
      );
    }
  });

  it("keeps hover below the selected row", () => {
    const hex = "#7C3AED";
    for (const isDark of [false, true]) {
      expect(alphaOf(chatRowTint(hex, isDark, { hover: true }))).toBeLessThan(
        alphaOf(chatRowTint(hex, isDark, { active: true })),
      );
    }
  });
});

describe("groupRowTint", () => {
  it("keeps the resting wash quiet and lets the open group stand clear", () => {
    const hex = "#7C3AED";
    for (const isDark of [false, true]) {
      const rest = alphaOf(groupRowTint(hex, isDark));
      const hover = alphaOf(groupRowTint(hex, isDark, { hover: true }));
      const open = alphaOf(groupRowTint(hex, isDark, { active: true }));
      // Rest is only a hint of the colour; the open row is more than twice it.
      expect(rest).toBeLessThanOrEqual(isDark ? 0.09 : 0.06);
      expect(open).toBeGreaterThan(rest * 2);
      expect(rest).toBeLessThan(hover);
      expect(hover).toBeLessThan(open);
    }
  });
});

describe("neutralRowTint", () => {
  it("keeps Unsorted Chats on the sidebar's own colour, never at band strength", () => {
    for (const isDark of [false, true]) {
      const rest = alphaOf(neutralRowTint(isDark));
      // Light mode has no wash at all: the row is the sidebar's own white.
      expect(rest).toBe(isDark ? 0.02 : 0);
      expect(rest).toBeLessThanOrEqual(0.02);
      // Far below the 6% light / 9% dark a coloured topic rests at.
      expect(rest).toBeLessThan(alphaOf(groupRowTint("#7C3AED", isDark)) / 2);
      const hover = alphaOf(neutralRowTint(isDark, { hover: true }));
      const open = alphaOf(neutralRowTint(isDark, { active: true }));
      expect(rest).toBeLessThan(hover);
      expect(hover).toBeLessThan(open);
      // Selected is a notch, not a slab: still well under a coloured topic's rest.
      expect(open).toBeLessThanOrEqual(isDark ? 0.08 : 0.02);
      expect(open).toBeLessThan(alphaOf(groupRowTint("#7C3AED", isDark)));
    }
  });

  it("brackets Unsorted Chats with a trace, not the slate default", () => {
    for (const isDark of [false, true]) {
      expect(alphaOf(neutralRule(isDark))).toBeLessThan(
        alphaOf(groupRule("#7C3AED", isDark)) / 2,
      );
    }
  });

  it("keeps a chat under it below the group's hover and open washes", () => {
    // The group has no wash at rest, so an open chat may lead it — but never the
    // washes that mark the group itself as hovered or open.
    for (const isDark of [false, true]) {
      expect(
        alphaOf(neutralRowTint(isDark, { hover: true, chat: true })),
      ).toBeLessThan(alphaOf(neutralRowTint(isDark, { hover: true })));
      expect(
        alphaOf(neutralRowTint(isDark, { active: true, chat: true })),
      ).toBeLessThan(alphaOf(neutralRowTint(isDark, { active: true })));
    }
  });
});
