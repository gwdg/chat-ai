import { useMemo, useState } from "react";
import DOMPurify from "dompurify";
import { TriangleAlert, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useBrand } from "../../config/BrandProvider";
import { localizeBrandValue } from "../../config/brands";

// One dismissal per brand and browser session. sessionStorage resets when the
// tab closes, so a new visit shows the notice again; the conversation itself
// remounts on every chat, so component state alone would bring it back at once.
const dismissalKey = (brandId) => `chatai.brand-chat-notice.${brandId}`;

const readDismissed = (brandId) => {
  try {
    return sessionStorage.getItem(dismissalKey(brandId)) === "1";
  } catch {
    return false;
  }
};

// Replaces the generic hallucination warning when the brand supplies its own
// chat disclaimer. Sanitized like the new-conversation disclaimer. A brand that
// sets `chatDisclaimerDismissible` may hide the notice for this session.
export default function BrandChatWarning() {
  const { i18n } = useTranslation();
  const { brand } = useBrand();
  const html = localizeBrandValue(brand?.chatDisclaimer, i18n.language);
  const clean = useMemo(
    () => (html ? DOMPurify.sanitize(html, { ADD_ATTR: ["target"] }) : ""),
    [html],
  );
  const [dismissed, setDismissed] = useState(() => readDismissed(brand.id));

  if (!clean || dismissed) return null;

  const dismissible = brand?.chatDisclaimerDismissible === true;
  const dismiss = () => {
    try {
      sessionStorage.setItem(dismissalKey(brand.id), "1");
    } catch {
      // Blocked storage: hide it for this mount only.
    }
    setDismissed(true);
  };

  return (
    <div className="mx-auto w-full max-w-3xl select-none rounded-lg border border-base-300 bg-base-100 px-3 py-2 flex gap-2 items-center shadow-sm dark:shadow-dark">
      <TriangleAlert className="h-[18px] min-w-[18px] text-accent" />
      <div
        className="flex-1 text-base-content text-sm [&_p]:mb-1 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_a]:text-accent [&_a:hover]:underline"
        dangerouslySetInnerHTML={{ __html: clean }}
      />
      {dismissible && (
        <button
          type="button"
          onClick={dismiss}
          className="btn btn-ghost btn-xs btn-square"
          aria-label={i18n.t("common.close")}
          title={i18n.t("common.close")}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
