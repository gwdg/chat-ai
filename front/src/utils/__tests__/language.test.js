import { afterEach, describe, expect, it, vi } from "vitest";

import {
  applyLanguageChoice,
  detectLanguage,
  initialLanguage,
  LANGUAGE_AUTO,
  LANGUAGE_STORAGE_KEY,
  readLanguageChoice,
  SUPPORTED_LANGUAGES,
} from "../language";

const fakeI18n = () => ({ changeLanguage: vi.fn(() => Promise.resolve()) });

const setBrowserLanguages = (languages) => {
  Object.defineProperty(window.navigator, "languages", {
    configurable: true,
    get: () => languages,
  });
  Object.defineProperty(window.navigator, "language", {
    configurable: true,
    get: () => languages[0],
  });
};

describe("language choice", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("narrows the browser languages to the shipped translations", () => {
    setBrowserLanguages(["de-CH", "en-US"]);
    expect(detectLanguage()).toBe("de");
    setBrowserLanguages(["fr-FR", "de"]);
    expect(detectLanguage()).toBe("de");
    setBrowserLanguages(["fr-FR"]);
    expect(detectLanguage()).toBe("en");
    expect(SUPPORTED_LANGUAGES).toEqual(["en", "de"]);
  });

  it("treats a missing or unsupported stored value as automatic", () => {
    expect(readLanguageChoice()).toBe(LANGUAGE_AUTO);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "fr");
    expect(readLanguageChoice()).toBe(LANGUAGE_AUTO);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "DE");
    expect(readLanguageChoice()).toBe("de");
  });

  it("applies an explicit choice and remembers it", () => {
    const i18n = fakeI18n();
    expect(applyLanguageChoice(i18n, "de")).toBe("de");
    expect(i18n.changeLanguage).toHaveBeenCalledWith("de");
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("de");
    expect(initialLanguage()).toBe("de");
  });

  it("clears the detector cache for automatic so the next load detects again", () => {
    setBrowserLanguages(["de-DE"]);
    localStorage.setItem("i18nextLng", "en");
    const i18n = fakeI18n();

    expect(applyLanguageChoice(i18n, LANGUAGE_AUTO)).toBe("de");
    expect(i18n.changeLanguage).toHaveBeenCalledWith("de");
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe(LANGUAGE_AUTO);
    expect(localStorage.getItem("i18nextLng")).toBeNull();
    // No explicit language is handed to `i18n.init`, so detection runs.
    expect(initialLanguage()).toBeUndefined();
  });
});
