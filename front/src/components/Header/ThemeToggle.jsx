import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { Sun, Moon, ColorPalette } from "@carbon/icons-react";

import {
  selectBrandTheme,
  selectDarkMode,
  setBrandTheme,
  setDarkMode,
  setLightMode,
  toggleTheme,
} from "../../Redux/reducers/interfaceSettingsSlice";
import { useBrand } from "../../config/BrandProvider";
import { brandThemes, localizeBrandValue } from "../../config/brands";

/**
 * Light/dark switch, plus one entry per extra brand theme (`brand.themes[]`).
 * A brand without extra themes keeps the plain sun/moon button. Selecting an
 * extra theme stores it as `interface_settings.theme`; selecting Light or Dark
 * returns to the brand's default palette pair and sets the matching preference.
 */
export default function ThemeToggle() {
  const dispatch = useDispatch();
  const { t, i18n } = useTranslation();
  const { brand } = useBrand();

  const isDarkMode = useSelector(selectDarkMode);
  const themeId = useSelector(selectBrandTheme);
  const themes = brandThemes(brand);
  const activeTheme = themes.find((theme) => theme.id === themeId) ?? null;
  // The button shows what a theme toggle will do, so a pinned-scheme theme
  // (business is dark-only) still offers the opposite mode on click.
  const activeDark = activeTheme?.colorScheme
    ? activeTheme.colorScheme === "dark"
    : isDarkMode;

  if (themes.length === 0) {
    return (
      <button
        className="btn btn-ghost btn-sm btn-square touch-manipulation px-6"
        data-guide="theme-toggle"
        onClick={() => dispatch(toggleTheme())}
        title={t("theme.label")}
        aria-label={t("theme.label")}
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        {isDarkMode ? (
          <Sun size={20} className="flex-shrink-0 text-accent" />
        ) : (
          <Moon size={20} className="flex-shrink-0 text-accent" />
        )}
      </button>
    );
  }

  const chooseLight = () => {
    dispatch(setBrandTheme("default"));
    dispatch(setLightMode());
  };
  const chooseDark = () => {
    dispatch(setBrandTheme("default"));
    dispatch(setDarkMode());
  };

  return (
    <div className="dropdown dropdown-end" data-guide="theme-toggle">
      <div
        tabIndex={0}
        role="button"
        className="btn btn-ghost btn-sm btn-square touch-manipulation px-6"
        aria-label={t("theme.label")}
        title={t("theme.label")}
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        {activeTheme ? (
          <ColorPalette size={20} className="flex-shrink-0 text-accent" />
        ) : activeDark ? (
          <Sun size={20} className="flex-shrink-0 text-accent" />
        ) : (
          <Moon size={20} className="flex-shrink-0 text-accent" />
        )}
      </div>
      <ul
        tabIndex={0}
        className="dropdown-content menu z-50 mt-2 w-44 rounded-box border border-base-300 bg-base-100 p-1 text-sm shadow-lg"
      >
        <li>
          <button
            type="button"
            className={!activeTheme && !isDarkMode ? "active" : ""}
            onClick={chooseLight}
          >
            <Sun size={16} className="text-accent" />
            {t("theme.light")}
          </button>
        </li>
        <li>
          <button
            type="button"
            className={!activeTheme && isDarkMode ? "active" : ""}
            onClick={chooseDark}
          >
            <Moon size={16} className="text-accent" />
            {t("theme.dark")}
          </button>
        </li>
        <li className="menu-title px-2 pb-0 pt-2 text-xs uppercase opacity-60">
          {t("theme.brand_themes")}
        </li>
        {themes.map((theme) => (
          <li key={theme.id}>
            <button
              type="button"
              className={activeTheme?.id === theme.id ? "active" : ""}
              onClick={() => dispatch(setBrandTheme(theme.id))}
            >
              <ColorPalette size={16} className="text-accent" />
              {localizeBrandValue(theme.label, i18n.language) || theme.id}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
