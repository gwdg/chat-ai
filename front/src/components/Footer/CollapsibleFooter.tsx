import { useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";

import VersionDisplay from "./VersionDisplay";
import LanguageSelector from "./LanguageSelector";
import ThemeToggle from "../Header/ThemeToggle";
import { useBrand } from "../../config/BrandProvider";

// Links every brand gets unless its profile replaces the `footer.links` map.
const DEFAULT_FOOTER_LINKS: Record<string, Record<string, unknown>> = {
  imprint: {},
  privacy: {},
  terms: {},
  docs: {},
};

type FooterLink = {
  id: string;
  label: string;
  url: string;
};

/**
 * A footer entry may carry a literal label or an object keyed by language, so a
 * brand can name its own legal pages without adding keys to the global i18n
 * files. Anything it does not name falls back to `footer.<id>`.
 */
function footerLabel(
  entry: any,
  id: string,
  t: (key: string) => string,
  language: string,
) {
  if (!entry?.label) return t(`footer.${id}`);
  if (typeof entry.label === "string") return entry.label;
  const languageCode = (language || "en").split("-")[0];
  return (
    entry.label[languageCode] ??
    entry.label.en ??
    Object.values(entry.label)[0] ??
    t(`footer.${id}`)
  );
}

export default function CollapsibleFooter({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const { t, i18n } = useTranslation();
  const { brand } = useBrand();

  const configured = brand?.footer?.links ?? DEFAULT_FOOTER_LINKS;
  const links: FooterLink[] = Object.entries(configured)
    .map(([id, entry]: [string, any]) => ({
      id,
      label: footerLabel(entry, id, t, i18n.language),
      url: entry?.url ?? brand?.links?.[id],
      visible: entry?.visible !== false,
    }))
    .filter((link) => link.visible && Boolean(link.url));
  // The ISO 27001 certificate is GWDG's; a sub-brand switches it off.
  const showIso = brand?.footer?.isoCertified !== false;

  return (
    <footer className={`bg-base-100 rounded-xl text-xs md:text-sm ${className}`}>
      {/* Header / handle: always visible */}
      <div className="flex justify-between">
        
        <div className=" h-[3vh] top-0 flex items-center justify-center gap-3 truncate overflow-hidden">
          <button
          type="button"
          aria-expanded={open}
          aria-controls="footer-content"
          onClick={() => {}}
          className="w-full h-[3vh] flex items-center justify-center gap-2 rounded-t-xl"
        >
        </button>
          {/* Version Display - Desktop and Tablet */}
          <div className="hidden md:block flex flex-col md:flex-row justify-center items-center gap-4 text-base-content w-full md:p-0 py-2">
            <VersionDisplay />
          </div>
          {links.map((link) => (
            <Link key={link.id} to={link.url} target="_blank">
              <p className="text-center text-info hover:underline">{link.label}</p>
            </Link>
          ))}
        </div>

        {/* Right section */}
        <div className="interface-toggles h-[3vh] top-0 flex items-center pr-3 gap-2"> 
          {showIso ? (
            <p className="hidden md:block text-center w-full flex flex-grow whitespace-nowrap overflow-visible text-base-content">
              {t("footer.iso_certified")}
            </p>
          ) : null}
          <ThemeToggle />
          <LanguageSelector />
        </div>

      </div>
    </footer>
  );
}
