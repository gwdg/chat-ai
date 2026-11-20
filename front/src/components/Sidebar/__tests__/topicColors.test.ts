import { describe, expect, it } from "vitest";

import { chatRowTint, groupRowTint, withAlpha } from "../topicColors";

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
