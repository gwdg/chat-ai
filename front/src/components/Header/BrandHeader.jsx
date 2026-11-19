import { useTranslation } from "react-i18next";

import { useBrand } from "../../config/BrandProvider";
import { localizeBrandValue, withBase } from "../../config/brands";

// The brand's optional header bar, shown above every page. A brand without a
// `header` object gets no bar, so the default look is unchanged.
export default function BrandHeader() {
  const { i18n } = useTranslation();
  const { brand } = useBrand();
  const header = brand?.header;
  if (!header) return null;

  const title = localizeBrandValue(header.title, i18n.language);
  const subtitle = localizeBrandValue(header.subtitle, i18n.language);
  const logo = header.logo ? withBase(header.logo) : null;

  return (
    <div
      className="flex w-full items-center gap-5 px-4 py-2 bg-white text-black h-20"
      style={{ color: header.textColor, backgroundColor: header.backgroundColor }}
    >
      {logo && (
        <img className="h-full w-auto" src={logo} alt={header.logoAlt ?? ""} />
      )}
      <div className="flex flex-col">
        {title && <div className="text-lg font-black">{title}</div>}
        {subtitle && <div className="text-base font-light">{subtitle}</div>}
      </div>
    </div>
  );
}
