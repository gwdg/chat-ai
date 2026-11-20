import { useMemo } from "react";
import DOMPurify from "dompurify";
import { TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useBrand } from "../../config/BrandProvider";
import { localizeBrandValue } from "../../config/brands";

// Replaces the generic hallucination warning when the brand supplies its own
// chat disclaimer. Sanitized like the new-conversation disclaimer.
export default function BrandChatWarning() {
  const { i18n } = useTranslation();
  const { brand } = useBrand();
  const html = localizeBrandValue(brand?.chatDisclaimer, i18n.language);
  const clean = useMemo(
    () => (html ? DOMPurify.sanitize(html, { ADD_ATTR: ["target"] }) : ""),
    [html],
  );
  if (!clean) return null;

  return (
    <div className="mx-auto w-full max-w-3xl select-none rounded-lg border border-base-300 bg-base-100 px-3 py-2 flex gap-2 items-center shadow-sm dark:shadow-dark">
      <TriangleAlert className="h-[18px] min-w-[18px] text-accent" />
      <div
        className="text-base-content text-sm [&_p]:mb-1 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_a]:text-accent [&_a:hover]:underline"
        dangerouslySetInnerHTML={{ __html: clean }}
      />
    </div>
  );
}
