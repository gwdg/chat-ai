import branding, { useBrandingHtml } from "../../branding";

// Disclaimer HTML configured via the branding directory, shown below the
// input box on every new (empty) conversation. Plain tags are styled here so
// the HTML files do not need any classes.
export default function BrandingDisclaimer() {
  const clean = useBrandingHtml(branding.disclaimer);
  if (!clean) return null;

  return (
    <div
      className="w-full max-w-3xl mx-auto mt-3 px-4 py-3 text-left select-none rounded-lg bg-gray-100 dark:bg-bg_dark text-gray-700 dark:text-gray-300 text-xs leading-relaxed shadow-sm dark:shadow-dark
        [&_h2]:font-semibold [&_h2]:text-gray-800 dark:[&_h2]:text-gray-100 [&_h2]:mb-2
        [&_p]:mb-1.5 [&_p:last-child]:mb-0 [&_strong]:font-semibold
        [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5
        [&_a]:text-tertiary [&_a:hover]:underline"
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
