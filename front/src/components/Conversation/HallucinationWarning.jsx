import { Trans } from "react-i18next";
import { TriangleAlert } from "lucide-react";

// Persistent short notice (banner) shown in active conversations.
// Replaces the former dismissible hallucination warning.
export default function HallucinationWarning() {
  return (
    <div className="flex justify-between pb-2">
      <div className="w-full h-full min-h-10 sticky select-none bg-gray-200 dark:bg-bg_dark m-1 py-1.5 px-3 rounded-lg flex gap-2 items-center shadow-sm dark:shadow-dark">
        <TriangleAlert className="h-[18px] min-w-[18px] text-[#009EE0]" />
        <p className="dark:text-white text-black text-sm">
          <Trans i18nKey="alert.ohb_banner" />
        </p>
      </div>
    </div>
  );
}
