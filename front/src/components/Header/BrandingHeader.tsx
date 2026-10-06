import { useTranslation } from "react-i18next";
import branding, { localize } from "../../branding";

// Header bar configured via the branding directory (see vite-plugin-branding.ts).
export default function BrandingHeader() {
  const { i18n } = useTranslation();
  const header = branding.header;
  if (!header) return null;

  const title = localize(header.title, i18n.language);
  const subtitle = localize(header.subtitle, i18n.language);

  return (
    <div
      className="flex items-center gap-5 px-4 py-2 bg-white text-black h-20"
      style={{ color: header.textColor, backgroundColor: header.backgroundColor }}
    >
      {header.logo && <img className="h-full w-auto" src={header.logo} alt={header.logoAlt ?? ""} />}
      <div className="flex flex-col">
        {title && <div className="text-lg font-black">{title}</div>}
        {subtitle && <div className="text-md font-light">{subtitle}</div>}
      </div>
    </div>
  );
}
