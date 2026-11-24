// Language choice and application.
//
// The app ships two translations. `i18next-browser-languagedetector` picks the
// browser language on first visit and caches it in `localStorage.i18nextLng`,
// which is why a choice used to stick without any of this. An explicit "auto"
// choice cannot be expressed by that cache, so the user's decision lives under
// its own key next to it and is applied before the first render.

export const LANGUAGE_STORAGE_KEY = "chatai.language";
export const SUPPORTED_LANGUAGES = ["en", "de"];
export const LANGUAGE_AUTO = "auto";

const normalize = (value) => String(value ?? "").trim().toLowerCase();

/** The browser's preferred language, narrowed to the two translations. */
export const detectLanguage = () => {
  if (typeof navigator === "undefined") return "en";
  const candidates = Array.isArray(navigator.languages)
    ? navigator.languages
    : [navigator.language];
  for (const candidate of candidates) {
    const code = normalize(candidate).split("-")[0];
    if (SUPPORTED_LANGUAGES.includes(code)) return code;
  }
  return "en";
};

/** The stored choice, or `auto` when the user never made one. */
export const readLanguageChoice = () => {
  try {
    const stored = normalize(localStorage.getItem(LANGUAGE_STORAGE_KEY));
    return SUPPORTED_LANGUAGES.includes(stored) ? stored : LANGUAGE_AUTO;
  } catch {
    return LANGUAGE_AUTO;
  }
};

const writeLanguageChoice = (choice) => {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, choice);
  } catch {
    // Blocked storage: the choice lasts for this page load only.
  }
};

/**
 * Applies a choice (`auto`, `en` or `de`) to an i18next instance.
 *
 * `auto` first maps to the detected language and then clears the detector's own
 * cache, so the *next* load detects again instead of repeating today's browser
 * language after the user has changed their mind.
 */
export const applyLanguageChoice = (i18n, choice) => {
  if (!i18n) return detectLanguage();
  const wanted = SUPPORTED_LANGUAGES.includes(normalize(choice))
    ? normalize(choice)
    : LANGUAGE_AUTO;
  const language = wanted === LANGUAGE_AUTO ? detectLanguage() : wanted;
  writeLanguageChoice(wanted);
  void i18n.changeLanguage(language);
  if (wanted === LANGUAGE_AUTO) {
    try {
      localStorage.removeItem("i18nextLng");
    } catch {
      // Blocked storage: nothing to clear.
    }
  }
  return language;
};

/** The language `i18n.init` should start with, given the stored choice. */
export const initialLanguage = () => {
  const choice = readLanguageChoice();
  return choice === LANGUAGE_AUTO ? undefined : choice;
};
