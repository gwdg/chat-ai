import { Trans, useTranslation } from "react-i18next";

import english_flag from "../../assets/english_flag.svg";
import german_flag from "../../assets/german_flag.svg";

export default function LanguageSelector() {
    // Initialize internationalization hooks
    const { i18n } = useTranslation();
    // Language configuration object mapping language codes to their flag icons
    const lngs = {
        en: english_flag,
        de: german_flag,
    };

    return (
    <div className="flex gap-4 flex-col">
    {/* Language Toggle Buttons */}
    {Object.keys(lngs).map((lng) => (
        <button
        key={lng}
        style={{
            fontWeight: i18n.resolvedLanguage === lng ? "bold" : "normal",
        }}
        type="submit"
        onClick={() => i18n.changeLanguage(lng)}
        >
        <img src={lngs[lng]} alt={`${lng} language flag`} />
        </button>
        ))}
    </div>
    );
}