import { TriangleAlert } from "lucide-react";
import branding, { useBrandingHtml } from "../../branding";

// Chat disclaimer HTML configured via the branding directory, shown
// permanently at the top of active conversations instead of the default
// hallucination warning.
export default function BrandingChatDisclaimer() {
  const clean = useBrandingHtml(branding.chatDisclaimer);
  if (!clean) return null;

  return (
    <div className="flex justify-between pb-2">
      <div className="w-full h-full min-h-10 sticky select-none bg-gray-200 dark:bg-bg_dark m-1 py-1.5 px-3 rounded-lg flex gap-2 items-center shadow-sm dark:shadow-dark">
        <TriangleAlert className="h-[18px] min-w-[18px] text-[#009EE0]" />
        <div
          className="dark:text-white text-black text-sm [&_p]:mb-1 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_a]:text-tertiary [&_a:hover]:underline"
          dangerouslySetInnerHTML={{ __html: clean }}
        />
      </div>
    </div>
  );
}
