import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import BaseModal from "../BaseModal";
import { addSource } from "../../db/workspaceDb";
import { newId } from "../../db";
import { hasLocalMcpServerValue } from "../../agent/mcp";
import { selectUserSettings } from "../../Redux/reducers/userSettingsReducer";
import { defaultCapabilities } from "../../workspace/capabilities";
import { DEVICE_PLANE_KINDS } from "../../workspace/deviceId";

const KINDS: SourceKind[] = ["local", "mcp"];

export default function AddSourceModal({ isOpen, onClose, workspaceId, onAdded }) {
  const { t } = useTranslation();
  const userSettings = useSelector(selectUserSettings);
  const [kind, setKind] = useState<SourceKind>("local");
  const [label, setLabel] = useState("");
  const [readOnly, setReadOnly] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [mcpEndpoint, setMcpEndpoint] = useState("");
  const [mcpTransport, setMcpTransport] = useState<"streamable-http" | "sse">(
    "streamable-http",
  );
  const [mcpAllowlist, setMcpAllowlist] = useState("");

  const localMcpEnabled =
    userSettings?.tools?.mcp === true &&
    hasLocalMcpServerValue(userSettings?.mcp_servers);

  const availableKinds = useMemo(
    () => KINDS.filter((item) => item !== "mcp" || localMcpEnabled),
    [localMcpEnabled],
  );

  useEffect(() => {
    if (!availableKinds.includes(kind)) setKind(availableKinds[0] ?? "local");
  }, [availableKinds, kind]);

  const reset = () => {
    setKind("local");
    setLabel("");
    setReadOnly(false);
    setError("");
    setBusy(false);
    setMcpEndpoint("");
    setMcpTransport("streamable-http");
    setMcpAllowlist("");
  };

  const close = () => {
    reset();
    onClose();
  };

  const finish = async (payload: {
    kind: SourceKind;
    label: string;
    config: any;
    handle?: FileSystemDirectoryHandle;
    status?: string;
  }) => {
    const id = newId();
    await addSource({
      id,
      workspaceId,
      kind: payload.kind,
      label: payload.label,
      config: payload.config,
      status: payload.status as any,
      capabilities: defaultCapabilities(payload.kind),
      readOnly,
      handle: payload.handle,
    });
    onAdded?.(id);
    close();
  };

  const submit = async () => {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      if (kind === "local") {
        if (!("showDirectoryPicker" in window)) {
          throw new Error(t("workspace.local_unsupported"));
        }
        const handle = await (window as any).showDirectoryPicker({
          mode: "readwrite",
        });
        await finish({
          kind,
          label: label.trim() || handle.name,
          config: { handleKey: "" },
          handle,
          status: "offline",
        });
        return;
      }
      if (kind === "mcp") {
        if (!mcpEndpoint.trim()) throw new Error(t("workspace.mcp_required"));
        await finish({
          kind,
          label: label.trim() || "MCP",
          config: {
            endpoint: mcpEndpoint.trim(),
            transport: mcpTransport,
            toolAllowlist: mcpAllowlist
              .split(",")
              .map((entry) => entry.trim())
              .filter(Boolean),
          },
          status: "offline",
        });
      }
    } catch (event) {
      const name = (event as Error)?.name;
      if (name === "AbortError") {
        setBusy(false);
        return;
      }
      setError(event instanceof Error ? event.message : String(event));
    } finally {
      setBusy(false);
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={close} titleKey="workspace.add_source">
      <div className="flex flex-col gap-3 pb-2">
        <div className="flex flex-wrap gap-1">
          {availableKinds.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setKind(item)}
              className={`btn btn-sm ${kind === item ? "btn-accent" : "btn-ghost"}`}
            >
              {t(`workspace.kind_${item}`)}
            </button>
          ))}
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-base-content/70">
            {t("workspace.source_label")}
          </span>
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder={t(`workspace.kind_${kind}`)}
            className="input input-bordered w-full"
          />
        </label>

        {kind === "local" && (
          <p className="text-xs leading-relaxed text-base-content/60">
            {t("workspace.local_hint")}
          </p>
        )}

        {kind === "mcp" && (
          <>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-base-content/70">
                {t("workspace.mcp_endpoint")}
              </span>
              <input
                value={mcpEndpoint}
                onChange={(event) => setMcpEndpoint(event.target.value)}
                placeholder="http://localhost:9000/mcp"
                className="input input-bordered w-full"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-base-content/70">
                {t("workspace.mcp_transport")}
              </span>
              <select
                value={mcpTransport}
                onChange={(event) =>
                  setMcpTransport(event.target.value as "streamable-http" | "sse")
                }
                className="select select-bordered w-full"
              >
                <option value="streamable-http">Streamable HTTP</option>
                <option value="sse">SSE</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-base-content/70">
                {t("workspace.mcp_allowlist")}
              </span>
              <input
                value={mcpAllowlist}
                onChange={(event) => setMcpAllowlist(event.target.value)}
                placeholder="list_directory, read_file, write_file"
                className="input input-bordered w-full"
              />
            </label>
            <p className="text-xs leading-relaxed text-base-content/60">
              {t("workspace.mcp_hint")}
            </p>
          </>
        )}

        {DEVICE_PLANE_KINDS.has(kind) && (
          <p className="text-xs text-warning">{t("workspace.device_only_hint")}</p>
        )}
        <label className="flex items-center gap-2 text-xs text-base-content/70">
          <input
            type="checkbox"
            checked={readOnly}
            onChange={(event) => setReadOnly(event.target.checked)}
            className="checkbox checkbox-sm"
          />
          <span>
            {t("workspace.source_read_only")}
            <span className="ml-1 text-base-content/45">
              {t("workspace.source_read_only_hint")}
            </span>
          </span>
        </label>

        {error && <p className="text-xs text-error">{error}</p>}

        <div className="mt-2 flex justify-end gap-2">
          <button type="button" className="btn" onClick={close}>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="btn btn-accent"
            onClick={submit}
            disabled={busy}
          >
            {t("workspace.add_source")}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
