import { describe, expect, it } from "vitest";

import {
  buildDemoForm,
  pickRandom,
  randomInt,
} from "../toolFormDemo";

const field = (form, name) => form.fields.find((item) => item.name === name);

describe("tool form demo fixture", () => {
  it("offers random selections plus a free-text answer", () => {
    const form = buildDemoForm();

    for (const name of ["colour", "time", "size"]) {
      const optionField = field(form, name);
      expect(["select", "radio"]).toContain(optionField.type);
      expect(
        optionField.options.some((option) => option.value === optionField.value),
      ).toBe(true);
    }

    expect(field(form, "answer")).toMatchObject({
      type: "textarea",
      label: "Add text answer",
    });
    expect(field(form, "hunger").value).toBeGreaterThanOrEqual(1);
    expect(field(form, "hunger").value).toBeLessThanOrEqual(5);
  });

  it("uses the injected randomness so the picks are reproducible", () => {
    const form = buildDemoForm(() => 0);

    expect(field(form, "colour").value).toBe("teal");
    expect(field(form, "time").value).toBe("morning");
    expect(field(form, "size").value).toBe("small");
    expect(field(form, "hunger").value).toBe(1);
    expect(field(form, "reminder").value).toBe(false);
  });

  it("clamps the random helpers to their ranges", () => {
    expect(pickRandom([{ value: "a" }], () => 0.99)).toBe("a");
    expect(pickRandom([], () => 0)).toBeUndefined();
    expect(randomInt(1, 5, () => 0.999)).toBe(5);
    expect(randomInt(1, 5, () => 0)).toBe(1);
  });
});
