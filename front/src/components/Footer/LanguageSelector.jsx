import { Trans, useTranslation } from "react-i18next";

import flag_english from "../../assets/flags/english.svg";
import flag_german from "../../assets/flags/german.svg";

export default function LanguageSelector() {
  // Initialize internationalization hooks
  const { i18n } = useTranslation();
  // Language configuration object mapping language codes to their flag icons
  const lngs = {
    en: flag_english,
    de: flag_german,
  };

  return (
    <div className="flex gap-4 flex-col">
      {/* Language Toggle Buttons */}
      {Object.keys(lngs)
        .filter((lng) => lng !== i18n.resolvedLanguage) // hide current language
        .map((lng) => (
          <button
            key={lng}
            type="submit"
            onClick={() => {
              console.log("Language changed to:", lng);
              i18n.changeLanguage(lng);
            }}
            className="cursor-pointer"
          >
            <img src={lngs[lng]} alt={`${lng} language flag`} />
          </button>
        ))}
    </div>
  );
}
