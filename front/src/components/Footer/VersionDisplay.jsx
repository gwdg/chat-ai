import packageJson from "../../../package.json";
import { useTranslation } from "react-i18next";
import { useBrand } from "../../config/BrandProvider";
import { localizeBrandValue } from "../../config/brands";

// The footer names the active brand, not the app package: a deployment that
// serves GAIA must not advertise itself as Chat AI. The version number still
// comes from the build. The link follows the brand's own home page, like the
// header logo, and falls back to the Chat AI repository for a brand without one.
// A brand name may be localized (`{ en, de }`), hence the `localizeBrandValue`.
const DEFAULT_HOME = "https://github.com/gwdg/chat-ai";

export default function VersionDisplay() {
  const { i18n } = useTranslation();
  const { brand } = useBrand();
  const name =
    localizeBrandValue(brand?.name, i18n.language) || packageJson.displayName;
  return (
    <p className="flex items-center gap-2">
      <a
        href={brand?.homeUrl || DEFAULT_HOME}
        target="_blank"
        rel="noopener noreferrer"
        className="text-info hover:underline inline-flex items-center"
      >
        {name}
        {" v"}
        {packageJson.version}
      </a>{" "}
    </p>
  );
}
