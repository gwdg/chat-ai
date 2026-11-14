import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import { FlaskConical, Loader2, Trash2 } from "lucide-react";

import BaseModal from "../BaseModal";
import { newId } from "../../db";
import {
  addMcpServer,
  removeMcpServer,
  updateMcpServer,
} from "../../Redux/reducers/userSettingsReducer";
import { normalizeMcpUrl, testMcpServer } from "../../agent/mcp";
import { useToast } from "../../hooks/useToast";

export default function McpServerModal({ isOpen, onClose, server }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { notifySuccess, notifyError } = useToast();
  const [name, setName] = useState(server?.name ?? "");
  const [kind, setKind] = useState(server?.kind ?? "local");
  const [url, setUrl] = useState(server?.url ?? "");
  const [serverId, setServerId] = useState(server?.serverId ?? "");
  const [authorization, setAuthorization] = useState(
    server?.headers?.Authorization ?? "",
  );
  const [testing, setTesting] = useState(false);

  const headers = authorization
    ? { ...(server?.headers ?? {}), Authorization: authorization }
    : Object.fromEntries(
        Object.entries(server?.headers ?? {}).filter(
          ([key]) => key !== "Authorization",
        ),
      );

  const save = () => {
    const target = kind === "local" ? url.trim() : serverId.trim();
    if (!target) {
      notifyError(
        t(
          kind === "local"
            ? "settings.mcp_test_invalid_url"
            : "settings.placeholder_mcp_id",
        ),
      );
      return;
    }
    if (kind === "local" && !normalizeMcpUrl(url)) {
      notifyError(t("settings.mcp_test_invalid_url"));
      return;
    }
    const patch = {
      name: name.trim() || undefined,
      kind,
      url: kind === "local" ? url.trim() : undefined,
      serverId: kind === "remote" ? serverId.trim() : undefined,
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
        url: kind === "local" ? url.trim() : serverId.trim(),
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

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey={server?.id ? "mcp.edit_title" : "mcp.add"}
    >
      <div className="flex flex-col gap-3 pb-2 text-sm">
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
            {t("mcp.kind_label")}
          </span>
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value)}
            className="select select-bordered w-full"
          >
            <option value="local">{t("mcp.kind_local")}</option>
            <option value="remote">{t("mcp.kind_remote")}</option>
          </select>
        </label>
        {kind === "local" ? (
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
        ) : (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-base-content/70">
              {t("mcp.server_id_label")}
            </span>
            <input
              data-guide="mcp-input"
              value={serverId}
              onChange={(event) => setServerId(event.target.value)}
              placeholder={t("settings.placeholder_mcp_id")}
              className="input input-bordered w-full"
            />
          </label>
        )}
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
              disabled={testing || !(kind === "local" ? url.trim() : serverId.trim())}
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
