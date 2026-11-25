import { useMemo } from "react";
import DOMPurify from "dompurify";
import { useTranslation } from "react-i18next";

import { useBrand } from "../../config/BrandProvider";
import { localizeBrandValue } from "../../config/brands";

// Brand HTML for a new conversation. The files carry plain tags only; the
// selectors below style them so a brand does not need classes. Everything is
// sanitized, so scripts and event handlers never reach the DOM.
export default function BrandDisclaimer() {
  const { i18n } = useTranslation();
  const { brand } = useBrand();
  const html = localizeBrandValue(brand?.disclaimer, i18n.language);
  const clean = useMemo(
    () => (html ? DOMPurify.sanitize(html, { ADD_ATTR: ["target"] }) : ""),
    [html],
  );
  if (!clean) return null;

  return (
    <div
      className="w-full max-w-3xl mx-auto mt-3 px-4 py-3 text-left select-none rounded-lg bg-base-200 text-base-content/70 text-xs leading-relaxed shadow-sm
        [&_h2]:font-semibold [&_h2]:text-base-content [&_h2]:mb-2
        [&_p]:mb-1.5 [&_p:last-child]:mb-0 [&_strong]:font-semibold
        [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5
        [&_a]:text-accent [&_a:hover]:underline"
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
