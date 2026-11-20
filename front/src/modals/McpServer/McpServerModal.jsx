import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import {
  FlaskConical,
  Loader2,
  Radar,
  Trash2,
  X,
} from "lucide-react";

import BaseModal from "../BaseModal";
import { newId } from "../../db";
import {
  addMcpServer,
  removeMcpServer,
  selectGlobalMcpServers,
  updateMcpServer,
} from "../../Redux/reducers/userSettingsReducer";
import { normalizeMcpUrl, testMcpServer } from "../../agent/mcp";
import {
  LOCAL_MCP_SCAN_FIRST_PORT,
  LOCAL_MCP_SCAN_LAST_PORT,
  scanLocalMcpServers,
} from "../../agent/mcpScan";
import { useToast } from "../../hooks/useToast";

export default function McpServerModal({ isOpen, onClose, server }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { notifySuccess, notifyError } = useToast();
  const globalServers = useSelector(selectGlobalMcpServers) ?? [];
  const [name, setName] = useState(server?.name ?? "");
  const [url, setUrl] = useState(server?.url ?? "");
  const [authorization, setAuthorization] = useState(
    server?.headers?.Authorization ?? "",
  );
  const [testing, setTesting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(null);
  const scanController = useRef(null);

  // Closing the dialog while the ports are still being probed stops the scan.
  useEffect(() => () => scanController.current?.abort(), []);

  const headers = authorization
    ? { ...(server?.headers ?? {}), Authorization: authorization }
    : Object.fromEntries(
        Object.entries(server?.headers ?? {}).filter(
          ([key]) => key !== "Authorization",
        ),
      );

  const save = () => {
    if (!url.trim()) {
      notifyError(t("settings.mcp_test_invalid_url"));
      return;
    }
    if (!normalizeMcpUrl(url)) {
      notifyError(t("settings.mcp_test_invalid_url"));
      return;
    }
    const patch = {
      name: name.trim() || undefined,
      url: url.trim(),
      ...(Object.keys(headers).length ? { headers } : { headers: undefined }),
    };
    if (server?.id) {
      dispatch(updateMcpServer({ id: server.id, patch }));
    } else {
      dispatch(addMcpServer({ id: newId(), ...patch }));
    }
    onClose();
  };

  const test = async () => {
    if (testing) return;
    setTesting(true);
    try {
      const result = await testMcpServer({
        url: url.trim(),
        headers,
      });
      if (result.name) setName(result.name);
      notifySuccess(
        t("settings.mcp_test_success", {
          name: result.name,
          count: result.toolCount,
        }),
      );
    } catch (error) {
      notifyError(
        t("settings.mcp_test_failed", {
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    } finally {
      setTesting(false);
    }
  };

  const remove = () => {
    if (!server?.id) return;
    dispatch(removeMcpServer(server.id));
    onClose();
  };

  const cancelScan = () => scanController.current?.abort();

  const scan = async () => {
    if (scanning) return;
    const controller = new AbortController();
    scanController.current = controller;
    const total = LOCAL_MCP_SCAN_LAST_PORT - LOCAL_MCP_SCAN_FIRST_PORT + 1;
    setScanning(true);
    setScanProgress({ scanned: 0, total, found: 0 });
    try {
      // Servers that are already configured stay untouched, also when the scan finds them.
      const known = new Set(
        globalServers
          .filter((item) => item?.url)
          .map((item) => normalizeMcpUrl(item.url))
          .filter(Boolean),
      );
      const ownPort = Number(window.location.port);
      let added = 0;
      const addFound = (entry) => {
        if (entry.port === ownPort) return;
        const entryUrl = normalizeMcpUrl(entry.url);
        if (!entryUrl || known.has(entryUrl)) return;
        known.add(entryUrl);
        dispatch(
          addMcpServer({
            id: newId(),
            name: t("mcp.scan_server_name", { port: entry.port }),
            url: entryUrl,
          }),
        );
        added += 1;
      };
      await scanLocalMcpServers({
        signal: controller.signal,
        onProgress: setScanProgress,
        onFound: addFound,
      });
      if (added) {
        notifySuccess(t("mcp.scan_done", { servers: added }));
      } else if (!controller.signal.aborted) {
        notifyError(t("mcp.scan_empty"), { autoClose: 4000 });
      }
    } catch (error) {
      notifyError(
        t("mcp.scan_failed", {
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    } finally {
      scanController.current = null;
      setScanning(false);
      setScanProgress(null);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey={server?.id ? "mcp.edit_title" : "mcp.add"}
    >
      <div className="flex flex-col gap-3 pb-2 text-sm">
        {!server?.id && (
          <div
            data-guide="mcp-scan"
            className="rounded-xl border border-base-300 bg-base-200/40 p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold">
                  {t("mcp.scan_title")}
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-base-content/60">
                  {t("mcp.scan_hint")}
                </p>
              </div>
              <button
                type="button"
                onClick={scanning ? cancelScan : scan}
                className="btn btn-sm shrink-0"
              >
                {scanning ? (
                  <X className="h-4 w-4" />
                ) : (
                  <Radar className="h-4 w-4" />
                )}
                {scanning ? t("mcp.scan_cancel") : t("mcp.scan_action")}
              </button>
            </div>
            {scanning && scanProgress && (
              <div className="mt-2">
                <progress
                  className="progress progress-accent w-full"
                  value={scanProgress.scanned}
                  max={scanProgress.total || 1}
                />
                <p className="mt-1 text-[11px] text-base-content/60">
                  {t("mcp.scan_progress", {
                    scanned: scanProgress.scanned,
                    total: scanProgress.total,
                    found: scanProgress.found,
                  })}
                </p>
              </div>
            )}
          </div>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-base-content/70">
            {t("mcp.name_label")}
          </span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("mcp.name_placeholder")}
            className="input input-bordered w-full"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-base-content/70">
            {t("mcp.url_label")}
          </span>
          <input
            data-guide="mcp-input"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder={t("settings.placeholder_mcp_url")}
            className="input input-bordered w-full"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-base-content/70">
            {t("mcp.auth_label")}
          </span>
          <input
            type="password"
            autoComplete="off"
            value={authorization}
            onChange={(event) => setAuthorization(event.target.value)}
            placeholder={t("settings.placeholder_mcp_auth")}
            className="input input-bordered w-full"
          />
        </label>
        <div className="mt-1 flex flex-wrap justify-between gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={test}
              disabled={testing || !url.trim()}
              className="btn btn-sm"
            >
              {testing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FlaskConical className="h-4 w-4" />
              )}
              {t("mcp.test")}
            </button>
            {server?.id && (
              <button
                type="button"
                onClick={remove}
                className="btn btn-sm btn-error"
              >
                <Trash2 className="h-4 w-4" />
                {t("mcp.remove")}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn" onClick={onClose}>
              {t("common.cancel")}
            </button>
            <button type="button" className="btn btn-accent" onClick={save}>
              {t("common.save")}
            </button>
          </div>
        </div>
      </div>
    </BaseModal>
  );
}
