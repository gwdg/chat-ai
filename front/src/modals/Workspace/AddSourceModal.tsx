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
  const [handle, setHandle] = useState<FileSystemDirectoryHandle | null>(null);
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

  // Chrome only exposes showDirectoryPicker() on a secure page, and a blocked picker used to look
  // like a dead click. Say why up front instead of failing after the button is pressed.
  const localBlocker =
    window.isSecureContext === false
      ? t("workspace.local_insecure")
      : !("showDirectoryPicker" in window)
        ? t("workspace.local_unsupported")
        : "";

  /** OK is the only action that creates the source, so it stays off until the form can succeed. */
  const canSubmit =
    kind === "local" ? !!handle && !localBlocker : kind === "mcp" ? !!mcpEndpoint.trim() : true;

  const reset = () => {
    setKind("local");
    setLabel("");
    setReadOnly(false);
    setHandle(null);
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

  /**
   * Picks the folder on its own, so the dialog can show what was chosen before the source is
   * created and OK can simply confirm it. `showDirectoryPicker` needs a user gesture, which the
   * button supplies.
   */
  const chooseFolder = async () => {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      if (window.isSecureContext === false) {
        throw new Error(t("workspace.local_insecure"));
      }
      if (!("showDirectoryPicker" in window)) {
        throw new Error(t("workspace.local_unsupported"));
      }
      let picked: FileSystemDirectoryHandle;
      try {
        picked = await (window as any).showDirectoryPicker({
          mode: readOnly ? "read" : "readwrite",
        });
      } catch (event) {
        // Chrome reports AbortError both for "user cancelled" and for "the file dialog could not
        // open / the folder was refused". Swallowing it made a blocked picker look like a click
        // that does nothing, so keep the failure visible and diagnosable.
        console.warn(
          "[workspace] directory picker did not return a folder",
          (event as Error)?.name,
          (event as Error)?.message,
        );
        if ((event as Error)?.name === "AbortError") {
          setError(t("workspace.local_aborted"));
          return;
        }
        throw event;
      }
      setHandle(picked);
    } catch (event) {
      setError(event instanceof Error ? event.message : String(event));
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      if (kind === "local") {
        if (!handle) throw new Error(t("workspace.choose_folder_required"));
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
        <div className="flex flex-col gap-1">
          {/* With one available kind a row of buttons is a control that cannot do anything, and
              clicking the already selected "Local folder" chip looked like a dead action. */}
          {availableKinds.length > 1 ? (
            <>
              <span className="text-xs font-medium text-base-content/70">
                {t("workspace.source_kind")}
              </span>
              <div
                role="group"
                aria-label={t("workspace.source_kind")}
                className="flex flex-wrap gap-1"
              >
                {availableKinds.map((item) => (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={kind === item}
                    onClick={() => setKind(item)}
                    className={`btn btn-sm ${kind === item ? "btn-accent" : "btn-ghost"}`}
                  >
                    {t(`workspace.kind_${item}`)}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm font-medium">{t(`workspace.kind_${kind}`)}</p>
          )}
        </div>

        {kind === "local" && (
          <>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-base-content/70">
                {t("workspace.source_folder")}
              </span>
              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  onClick={chooseFolder}
                  disabled={busy || !!localBlocker}
                  className="btn btn-sm shrink-0"
                >
                  {t("workspace.choose_folder")}
                </button>
                <span
                  data-testid="local-source-folder"
                  className={`truncate text-xs ${
                    handle ? "text-base-content" : "text-base-content/50"
                  }`}
                  title={handle?.name}
                >
                  {handle ? handle.name : t("workspace.no_folder_chosen")}
                </span>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-base-content/60">
              {t("workspace.local_hint")}
            </p>
            {localBlocker && (
              <p className="text-xs leading-relaxed text-error">{localBlocker}</p>
            )}
          </>
        )}

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
            disabled={busy || !canSubmit}
          >
            {t("common.ok")}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
