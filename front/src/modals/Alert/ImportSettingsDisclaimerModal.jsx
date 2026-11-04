import { useEffect, useMemo, useState } from "react";
import { Trans } from "react-i18next";
import BaseModal from "../BaseModal";

export default function ImportSettingsDisclaimerModal({
  isOpen,
  onClose,
  hasWebSearch,
  hasMcpServers,
  onResolve,
}) {
  const [allowWebSearch, setAllowWebSearch] = useState(true);
  const [allowMcpServers, setAllowMcpServers] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setAllowWebSearch(true);
    setAllowMcpServers(true);
  }, [isOpen]);

  const options = useMemo(() => {
    return [
      hasWebSearch
        ? {
            key: "web_search",
            checked: allowWebSearch,
            onChange: setAllowWebSearch,
            labelKey: "settings.label_web_search",
            bodyKey: "alert.import_web_search_disclaimer",
            tone: "red",
          }
        : null,
      hasMcpServers
        ? {
            key: "mcp_servers",
            checked: allowMcpServers,
            onChange: setAllowMcpServers,
            labelKey: "settings.label_mcp_server",
            bodyKey: "alert.import_mcp_disclaimer",
            tone: "yellow",
          }
        : null,
    ].filter(Boolean);
  }, [allowMcpServers, allowWebSearch, hasMcpServers, hasWebSearch]);

  const resolveAndClose = (payload) => {
    onResolve?.(payload);
    onClose?.();
  };

  const handleCancel = () => resolveAndClose({ action: "cancel" });

  const handleAllow = () =>
    resolveAndClose({
      action: "allow",
      allowWebSearch: hasWebSearch ? allowWebSearch : true,
      allowMcpServers: hasMcpServers ? allowMcpServers : true,
    });

  const handleDisallow = () => resolveAndClose({ action: "disallow" });

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleCancel}
      titleKey="alert.import_settings_title"
      maxWidth="max-w-lg"
      minimal={true}
    >
      <div className="flex flex-col gap-3">
        <p className="text-error">
          <Trans i18nKey="common.disclaimer" />
        </p>
        <p className="text-base-content text-sm whitespace-pre-line">
          <Trans i18nKey="alert.import_settings_intro" />
        </p>

        <div className="flex flex-col gap-2">
          {options.map((opt) => {
            const toneClasses =
              opt.tone === "red"
                ? "border-error/30 bg-error/10"
                : "border-warning/30 bg-warning/10";
            return (
              <label
                key={opt.key}
                className={[
                  "flex items-start gap-3 rounded-xl border p-3",
                  toneClasses,
                ].join(" ")}
              >
                <input
                  type="checkbox"
                  checked={opt.checked}
                  onChange={(e) => opt.onChange(e.target.checked)}
                  className="mt-1 checkbox checkbox-accent checkbox-sm"
                />
                <div className="flex flex-col gap-1">
                  <div className="text-sm font-medium text-base-content">
                    <Trans i18nKey={opt.labelKey} />
                  </div>
                  <div className="text-xs text-base-content whitespace-pre-line">
                    <Trans i18nKey={opt.bodyKey} />
                  </div>
                </div>
              </label>
            );
          })}
        </div>

        <div className="flex flex-col md:flex-row gap-2 pt-3 justify-center w-full">
          <button
            className="btn btn-accent md:w-fit w-full min-w-[150px] select-none"
            onClick={handleAllow}
          >
            <Trans i18nKey="common.allow" />
          </button>
          <button
            className="btn btn-neutral md:w-fit w-full min-w-[150px] select-none"
            onClick={handleDisallow}
          >
            <Trans i18nKey="common.disallow" />
          </button>
          <button
            className="btn btn-ghost text-primary dark:text-accent md:w-fit w-full min-w-[150px] select-none"
            onClick={handleCancel}
          >
            <Trans i18nKey="common.cancel" />
          </button>
        </div>
      </div>
    </BaseModal>
  );
}

