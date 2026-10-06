import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import DOMPurify from "dompurify";
import type { Localized } from "../vite-plugin-branding";

const branding = __BRANDING__;
export default branding;

// Picks the value for the given language ("de-DE" -> "de"), falling back to
// English and then to the first available value.
export function localize(value: Localized | null | undefined, language = ""): string | undefined {
  if (value == null) return undefined; // unset or empty in branding.yaml
  if (typeof value === "string") return value;
  return value[language] ?? value[language.split("-")[0]] ?? value.en ?? Object.values(value)[0];
}

// Localized and sanitized branding HTML for the current UI language
export function useBrandingHtml(value: Localized | undefined): string {
  const { i18n } = useTranslation();
  const html = localize(value, i18n.language);
  return useMemo(() => (html ? DOMPurify.sanitize(html, { ADD_ATTR: ["target"] }) : ""), [html]);
}
