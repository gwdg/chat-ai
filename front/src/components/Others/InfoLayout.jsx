import { ArrowLeft } from "@carbon/icons-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import BrandLogo from "./BrandLogo";
import { useBrand } from "../../config/BrandProvider";
import { localizeBrandValue } from "../../config/brands";
import {
  SafeMarkdown,
  plainRendererComponents,
} from "../Conversation/MessageAssistant/MarkdownRenderer";

/**
 * Shell for the static information pages (`/about`, `/accessibility`,
 * `/sitemap`). They are reachable from the footer, often in a new tab, so the
 * back control falls back to the chat when there is no history to return to.
 *
 * `content` is brand markdown. It is rendered through the app's own markdown
 * renderer (no raw HTML unless a caller passes `renderHtml`), so a brand file
 * cannot inject markup the chat renderer would refuse.
 */
export default function InfoLayout({ title, subtitle, content, children }) {
  const { i18n, t } = useTranslation();
  const navigate = useNavigate();
  const { brand } = useBrand();
  const markdown = localizeBrandValue(content, i18n.language);
  const sub = localizeBrandValue(subtitle, i18n.language);

  const back = useMemo(() => {
    return () => {
      if (typeof window !== "undefined" && window.history.length > 1) {
        navigate(-1);
        return;
      }
      navigate("/chat");
    };
  }, [navigate]);

  return (
    <div className="h-full w-full overflow-y-auto bg-base-100 text-base-content">
      <article className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <BrandLogo variant="small" className="h-8 w-auto" />
          <button
            type="button"
            onClick={back}
            className="btn btn-ghost btn-sm gap-1"
            data-guide="info-back"
          >
            <ArrowLeft size={16} />
            {t("info.back_to_chat")}
          </button>
        </div>
        <h1 className="text-2xl font-bold" tabIndex={-1}>
          {title}
        </h1>
        {sub && <p className="text-sm text-base-content/70">{sub}</p>}
        {markdown ? (
          <div
            className="text-base leading-relaxed
              [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold
              [&_h3]:mt-4 [&_h3]:mb-1.5 [&_h3]:text-base [&_h3]:font-semibold
              [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-6
              [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mb-1
              [&_a]:text-accent [&_a:hover]:underline [&_strong]:font-semibold
              [&_hr]:my-6 [&_hr]:border-base-300"
          >
            <SafeMarkdown components={plainRendererComponents}>
              {markdown}
            </SafeMarkdown>
          </div>
        ) : null}
        {children}
      </article>
    </div>
  );
}
