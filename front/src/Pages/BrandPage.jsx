import { useTranslation } from "react-i18next";

import InfoLayout from "../components/Others/InfoLayout";
import { useBrand } from "../config/BrandProvider";

/**
 * A brand-owned information page. `page` names the entry under `pages` in
 * `brand.json` (`about`, `accessibility`); the copy lives in the brand folder as
 * markdown, next to its disclaimers, so an institution can replace it without a
 * code change.
 *
 * A brand that ships no copy for the page still gets a usable screen: it names
 * the page and links the brand's own `links.<page>` target when one exists,
 * instead of showing an empty article.
 */
export default function BrandPage({ page, titleKey }) {
  const { t } = useTranslation();
  const { brand } = useBrand();
  const content = brand?.pages?.[page];
  const external = brand?.links?.[page];

  return (
    <InfoLayout title={t(titleKey)} content={content}>
      {!content && external ? (
        <p className="text-sm text-base-content/80">
          {t("info.page_external")}{" "}
          <a
            href={external}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            {t("info.open_page")}
          </a>
        </p>
      ) : null}
    </InfoLayout>
  );
}
