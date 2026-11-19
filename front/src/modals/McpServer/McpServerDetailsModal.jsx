// modals/McpServer/McpServerDetailsModal.jsx
// What a local MCP server reports about itself after the initialize handshake: version,
// protocol version, capabilities, instructions and tools. Opened by double-clicking the
// server in the sidebar or from its options menu.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CircleAlert, ExternalLink, Loader2, RefreshCw } from "lucide-react";

import BaseModal from "../BaseModal";
import { describeMcpServer } from "../../agent/mcp";

function Row({ label, children }) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="w-32 shrink-0 text-base-content/55">{label}</span>
      <span className="min-w-0 flex-1 break-words">{children}</span>
    </div>
  );
}

export default function McpServerDetailsModal({ isOpen, onClose, server }) {
  const { t } = useTranslation();
  const [details, setDetails] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const isRemote = server?.kind === "remote";

  useEffect(() => {
    if (!isOpen || !server || isRemote) return;
    let cancelled = false;
    setDetails(null);
    setError(null);
    setLoading(true);
    describeMcpServer({
      url: server.url,
      headers: server.headers,
      enabled: true,
    })
      .then((info) => {
        if (!cancelled) setDetails(info);
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, server, isRemote, attempt]);

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey="mcp.details_title"
      maxWidth="max-w-xl"
      contentClassName="p-5 pt-0 flex flex-col gap-2"
    >
      <div className="max-h-[70vh] overflow-y-auto">
        <div className="rounded-xl border border-base-300 bg-base-200/40 p-3">
          <Row label={t("mcp.details_name")}>
            {server?.name || server?.url || server?.serverId || "—"}
          </Row>
          <Row label={t("mcp.details_kind")}>
            {t(
              server?.kind === "remote" ? "mcp.kind_remote" : "mcp.kind_local",
            )}
          </Row>
          <Row label={t("mcp.details_address")}>
            {server?.kind === "remote" ? server?.serverId : server?.url}
          </Row>
        </div>

        {isRemote ? (
          <p className="mt-3 text-xs leading-snug text-base-content/70">
            {t("mcp.details_remote_unavailable")}
          </p>
        ) : loading ? (
          <div className="mt-3 flex items-center gap-2 text-xs text-base-content/70">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("mcp.details_loading")}
          </div>
        ) : error ? (
          <div className="mt-3 rounded-xl border border-error/40 bg-error/10 p-3">
            <p className="flex items-start gap-2 text-xs font-medium text-error">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {t("mcp.details_failed")}
            </p>
            <p className="mt-1 break-words text-xs text-base-content/70">
              {error}
            </p>
            <button
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
              className="btn btn-xs mt-2"
            >
              <RefreshCw className="h-3 w-3" />
              {t("mcp.details_retry")}
            </button>
          </div>
        ) : details ? (
          <div className="mt-3 space-y-3">
            <div className="space-y-1.5">
              <Row label={t("mcp.details_server_name")}>
                {details.name}
                {details.title && details.title !== details.name && (
                  <span className="text-base-content/55">
                    {" "}
                    ({details.title})
                  </span>
                )}
              </Row>
              <Row label={t("mcp.details_version")}>
                {details.version || t("mcp.details_none")}
              </Row>
              <Row label={t("mcp.details_protocol")}>
                {details.protocolVersion || t("mcp.details_none")}
              </Row>
              <Row label={t("mcp.details_website")}>
                {details.websiteUrl ? (
                  <a
                    href={details.websiteUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="link link-primary inline-flex items-center gap-1 break-all"
                  >
                    {details.websiteUrl}
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                ) : (
                  t("mcp.details_none")
                )}
              </Row>
              {details.description && (
                <Row label={t("mcp.details_description")}>
                  {details.description}
                </Row>
              )}
            </div>

            <div>
              <p className="text-xs font-medium text-base-content/70">
                {t("mcp.details_capabilities")}
              </p>
              {details.capabilities.length ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  {details.capabilities.map((capability) => (
                    <span
                      key={capability.name}
                      className="badge badge-outline badge-sm"
                      title={capability.detail}
                    >
                      {capability.name}
                      {capability.detail ? ` · ${capability.detail}` : ""}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-xs text-base-content/55">
                  {t("mcp.details_none")}
                </p>
              )}
            </div>

            <div>
              <p className="text-xs font-medium text-base-content/70">
                {t("mcp.details_tools", { count: details.tools.length })}
              </p>
              {details.tools.length ? (
                <ul className="mt-1 space-y-1">
                  {details.tools.map((tool) => (
                    <li
                      key={tool.name}
                      className="rounded-lg border border-base-300 bg-base-200/30 px-2 py-1.5"
                    >
                      <p className="text-xs font-medium">{tool.name}</p>
                      {(tool.title || tool.description) && (
                        <p className="text-[11px] leading-snug text-base-content/60">
                          {tool.title && tool.title !== tool.name
                            ? `${tool.title} — `
                            : ""}
                          {tool.description}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-base-content/55">
                  {t("mcp.details_no_tools")}
                </p>
              )}
            </div>

            {details.instructions && (
              <div>
                <p className="text-xs font-medium text-base-content/70">
                  {t("mcp.details_instructions")}
                </p>
                <p className="mt-1 whitespace-pre-wrap rounded-lg border border-base-300 bg-base-200/30 px-2 py-1.5 text-[11px] leading-snug text-base-content/70">
                  {details.instructions}
                </p>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </BaseModal>
  );
}
