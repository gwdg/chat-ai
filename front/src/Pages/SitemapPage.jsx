import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import InfoLayout from "../components/Others/InfoLayout";
import { useAgents } from "../agents/agentStore";
import { useFolderList } from "../db";
import { useWorkspaceList } from "../db/workspaceDb";
import { useBrand } from "../config/BrandProvider";
import { isFeatureEnabled } from "../config/deployment";
import { isAgentsEnabled } from "../utils/modules";

/**
 * `/sitemap` — a plain index of what this deployment actually offers.
 *
 * The lists come from the same live queries the sidebar uses, and empty
 * sections are dropped, so an entry never points at a page a module switched
 * off or at a link that leads nowhere. `chat-ai` has no course model, so the
 * "courses" section GAIA's own sitemap renders does not apply here.
 */
export default function SitemapPage() {
  const { t } = useTranslation();
  const { brand } = useBrand();
  const topics = useFolderList();
  const workspaces = useWorkspaceList();
  const agents = useAgents();

  const showWorkspaces = isFeatureEnabled("workspaces");
  const showAgents = isAgentsEnabled() && isFeatureEnabled("agents");
  const showMeta = isFeatureEnabled("meta_chat");

  const sections = [
    {
      id: "general",
      title: t("sitemap.general"),
      links: [
        { to: "/chat", label: t("sidebar.new_conversation") },
        ...(showMeta ? [{ to: "/meta", label: t("meta_chat.help_label") }] : []),
      ],
    },
    {
      id: "pages",
      title: t("sitemap.pages"),
      links: [
        { to: "/about", label: t("about.title") },
        { to: "/accessibility", label: t("accessibility.title") },
      ],
    },
    {
      id: "topics",
      title: t("folders.topics_label"),
      links: topics.map((topic) => ({
        to: `/topic/${topic.id}`,
        label: topic.name || t("conversation.untitled"),
      })),
    },
    {
      id: "workspaces",
      title: t("workspace.sidebar_title"),
      links: showWorkspaces
        ? workspaces.map((workspace) => ({
            to: `/workspace/${workspace.id}`,
            label: workspace.name || t("workspace.source_browser.untitled_chat"),
          }))
        : [],
    },
    {
      id: "agents",
      title: t("workspace.agents"),
      links: showAgents
        ? agents.map((agent) => ({
            to: `/agent/${agent.id}`,
            label: agent.name || t("conversation.untitled"),
          }))
        : [],
    },
  ].filter((section) => section.links.length > 0);

  return (
    <InfoLayout title={t("sitemap.title")} content={brand?.pages?.sitemap}>
      <nav aria-label={t("sitemap.title")} className="flex flex-col gap-6">
        {sections.map((section) => (
          <section key={section.id} aria-labelledby={`sitemap-${section.id}`}>
            <h2
              id={`sitemap-${section.id}`}
              className="mb-2 text-sm font-semibold uppercase tracking-wide text-base-content/70"
            >
              {section.title}
            </h2>
            <ul className="flex flex-col gap-1">
              {section.links.map((link) => (
                <li key={`${section.id}-${link.to}`}>
                  <Link
                    to={link.to}
                    className="text-accent hover:underline inline-flex items-center gap-1 text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>
    </InfoLayout>
  );
}
