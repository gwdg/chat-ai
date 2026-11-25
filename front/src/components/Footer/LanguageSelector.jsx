import { Globe } from "@carbon/icons-react";
import { useTranslation } from "react-i18next";

import {
  applyLanguageChoice,
  LANGUAGE_AUTO,
  readLanguageChoice,
  SUPPORTED_LANGUAGES,
} from "../../utils/language";

const LANGUAGE_LABEL_KEY = {
  en: "language.english",
  de: "language.german",
};

/**
 * Footer language picker. "Automatic" follows the browser and is the state a
 * user never chose anything in; an explicit choice is stored by
 * `utils/language.js` and applied before the first render on the next visit.
 * Changing the language remounts the router (`App.jsx` keys it on
 * `i18n.language`), so every translated label is rebuilt.
 */
export default function LanguageSelector() {
  const { i18n, t } = useTranslation();
  const choice = readLanguageChoice();

  const choose = (value) => applyLanguageChoice(i18n, value);

  // The footer sits in the last grid row, flush with the bottom of the viewport.
  // A downward menu (daisyUI's default) would open entirely below the screen, so
  // the picker would look dead. Open upward instead.
  return (
    <div className="dropdown dropdown-top dropdown-end" data-guide="language-picker">
      <div
        tabIndex={0}
        role="button"
        className="btn btn-ghost btn-sm touch-manipulation gap-1 px-2"
        aria-label={t("language.label")}
        title={t("language.label")}
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        <Globe size={20} className="flex-shrink-0 text-accent" />
        <span className="hidden sm:inline text-xs uppercase">
          {choice === LANGUAGE_AUTO
            ? t("language.auto_short")
            : choice.toUpperCase()}
        </span>
      </div>
      <ul
        tabIndex={0}
        className="dropdown-content menu z-50 mb-2 w-48 rounded-box border border-base-300 bg-base-100 p-1 text-sm shadow-lg"
      >
        <li>
          <button
            type="button"
            className={choice === LANGUAGE_AUTO ? "active" : ""}
            onClick={() => choose(LANGUAGE_AUTO)}
          >
            <Globe size={16} className="text-accent" />
            {t("language.automatic")}
          </button>
        </li>
        {SUPPORTED_LANGUAGES.map((code) => (
          <li key={code}>
            <button
              type="button"
              className={choice === code ? "active" : ""}
              onClick={() => choose(code)}
            >
              <span className="inline-block w-6 text-center text-xs font-semibold uppercase text-base-content/70">
                {code}
              </span>
              {t(LANGUAGE_LABEL_KEY[code])}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
