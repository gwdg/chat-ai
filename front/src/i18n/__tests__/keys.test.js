import { describe, expect, it } from "vitest";
import en from "../en";
import de from "../de";
import { featureGuides } from "../../config/featureGuides";
import { useCases } from "../../config/useCases";

function paths(value, prefix = "", out = []) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    out.push(prefix);
    return out;
  }
  for (const [key, child] of Object.entries(value)) {
    paths(child, prefix ? `${prefix}.${key}` : key, out);
  }
  return out;
}

function hasPath(value, path) {
  return path.split(".").every((key) => {
    if (!value || typeof value !== "object" || !(key in value)) {
      value = undefined;
      return false;
    }
    value = value[key];
    return true;
  });
}

describe("i18n keys", () => {
  it("has identical key sets in English and German", () => {
    expect(paths(de).sort()).toEqual(paths(en).sort());
  });

  it("has translations for every feature guide step", () => {
    for (const [id, guide] of Object.entries(featureGuides)) {
      expect(hasPath(en, guide.titleKey), `${id} title (en)`).toBe(true);
      expect(hasPath(de, guide.titleKey), `${id} title (de)`).toBe(true);
      for (const step of guide.steps || []) {
        if (!step.textKey) continue;
        expect(hasPath(en, step.textKey), `${id} ${step.textKey} (en)`).toBe(true);
        expect(hasPath(de, step.textKey), `${id} ${step.textKey} (de)`).toBe(true);
      }
    }
  });

  it("has translations for every use case step", () => {
    for (const [id, useCase] of Object.entries(useCases)) {
      const titleKey = `use_cases.${id}.title`;
      expect(hasPath(en, titleKey), `${id} title (en)`).toBe(true);
      expect(hasPath(de, titleKey), `${id} title (de)`).toBe(true);
      for (const step of useCase.steps || []) {
        if (!step.textKey) continue;
        expect(hasPath(en, step.textKey), `${id} ${step.textKey} (en)`).toBe(true);
        expect(hasPath(de, step.textKey), `${id} ${step.textKey} (de)`).toBe(true);
      }
    }
  });
});
