import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { Pencil } from "lucide-react";

import BaseModal from "../BaseModal";
import AddSourceModal from "./AddSourceModal";
import WorkspaceStorageManager from "../../components/Workspace/WorkspaceStorageManager";
import IconColorPicker from "../../components/Sidebar/IconColorPicker";
import {
  createWorkspace,
  deleteWorkspace,
  updateWorkspace,
  useWorkspaceList,
} from "../../db/workspaceDb";
import { topicIconById } from "../../components/Sidebar/topicIcons";
import {
  TOPIC_COLORS,
  topicColorById,
  withAlpha,
} from "../../components/Sidebar/topicColors";

const DEFAULT_WORKSPACE_ICON = "rocket";

const errorMessage = (error) =>
  error instanceof Error ? error.message : String(error);

const placeholderName = (workspaces, base) => {
  const used = new Set(
    workspaces.map((workspace) => workspace.name.trim().toLowerCase()),
  );
  if (!used.has(base.toLowerCase())) return base;
  let index = 2;
  while (used.has(`${base} ${index}`.toLowerCase())) index += 1;
  return `${base} ${index}`;
};

export default function CreateWorkspaceModal({ isOpen, onClose }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const workspaces = useWorkspaceList();

  const [draftId, setDraftId] = useState(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(DEFAULT_WORKSPACE_ICON);
  const [color, setColor] = useState(TOPIC_COLORS[0].id);
  const [iconOpen, setIconOpen] = useState(false);
  const [addSourceKind, setAddSourceKind] = useState(null);
  const [nameBlurred, setNameBlurred] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const draftIdRef = useRef(null);
  const startedRef = useRef(false);
  const settledRef = useRef(false);
  const sessionRef = useRef(0);
  const pendingPatchRef = useRef({});
  const pickerSnapshotRef = useRef({
    icon: DEFAULT_WORKSPACE_ICON,
    color: TOPIC_COLORS[0].id,
  });

  // The draft row exists while the modal is open, so every panel below reads
  // the real workspace data; one effect starts it exactly once per open.
  useEffect(() => {
    if (!isOpen) {
      startedRef.current = false;
      sessionRef.current += 1;
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;
    settledRef.current = false;
    const session = sessionRef.current;
    const placeholder = placeholderName(
      workspaces,
      t("workspace.new_workspace"),
    );
    createWorkspace(placeholder)
      .then((id) => {
        if (sessionRef.current !== session) {
          void deleteWorkspace(id);
          return;
        }
        draftIdRef.current = id;
        setDraftId(id);
        const pending = pendingPatchRef.current;
        pendingPatchRef.current = {};
        if (pending.icon) void updateWorkspace(id, { icon: pending.icon });
        if (pending.color) void updateWorkspace(id, { color: pending.color });
      })
      .catch((event) => {
        setError(
          errorMessage(event).includes("already exists")
            ? t("workspace.name_taken")
            : t("workspace.create_error"),
        );
      });
  }, [isOpen, workspaces, t]);

  const resetDraftState = () => {
    setName("");
    setIcon(DEFAULT_WORKSPACE_ICON);
    setColor(TOPIC_COLORS[0].id);
    setIconOpen(false);
    setNameBlurred(false);
    setError("");
  };

  const cancel = async () => {
    if (settledRef.current) return;
    settledRef.current = true;
    sessionRef.current += 1;
    const id = draftIdRef.current;
    draftIdRef.current = null;
    setDraftId(null);
    if (id) {
      try {
        await deleteWorkspace(id);
      } catch {
        // A failed cleanup must not keep the dialog open.
      }
    }
    resetDraftState();
    onClose();
  };

  const create = async () => {
    const id = draftIdRef.current;
    if (busy || !id || !name.trim()) return;
    setBusy(true);
    setError("");
    try {
      await updateWorkspace(id, { name: name.trim() });
      settledRef.current = true;
      draftIdRef.current = null;
      onClose();
      navigate(`/workspace/${id}`);
    } catch (event) {
      setError(
        errorMessage(event).includes("already exists")
          ? t("workspace.name_taken")
          : errorMessage(event).includes("required")
            ? t("workspace.name_required")
            : t("workspace.create_error"),
      );
    } finally {
      setBusy(false);
    }
  };

  const chooseIcon = (id) => {
    setIcon(id);
    const draft = draftIdRef.current;
    if (draft) void updateWorkspace(draft, { icon: id });
    else pendingPatchRef.current.icon = id;
  };

  const chooseColor = (id) => {
    setColor(id);
    const draft = draftIdRef.current;
    if (draft) void updateWorkspace(draft, { color: id });
    else pendingPatchRef.current.color = id;
  };

  // Cancel in the picker puts back what the tile looked like when it opened;
  // the choices are persisted as they are made, so the restore persists too.
  const togglePicker = () => {
    if (!iconOpen) pickerSnapshotRef.current = { icon, color };
    setIconOpen(!iconOpen);
  };

  const cancelPicker = () => {
    const snapshot = pickerSnapshotRef.current;
    if (snapshot.icon !== icon) chooseIcon(snapshot.icon);
    if (snapshot.color !== color) chooseColor(snapshot.color);
    setIconOpen(false);
  };

  const SelectedIcon = topicIconById(icon).Icon;
  const selectedColor = topicColorById(color);

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={cancel}
      titleKey="workspace.create_title"
      maxWidth="max-w-[min(1280px,95vw)]"
      contentClassName="flex h-[min(78vh,720px)] flex-col gap-2 p-5 pt-0 overflow-y-auto md:overflow-hidden"
    >
      <div className="flex shrink-0 items-start gap-3 rounded-xl border border-base-300 bg-base-100 px-3 py-2">
        <div className="relative shrink-0">
          <button
            type="button"
            data-testid="create-workspace-icon"
            onClick={togglePicker}
            aria-label={t("folders.choose_icon")}
            aria-expanded={iconOpen}
            title={t("folders.choose_icon")}
            className="group relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl transition hover:brightness-95"
            style={{
              backgroundColor: withAlpha(selectedColor.hex, 0.16),
              color: selectedColor.hex,
            }}
          >
            <SelectedIcon size={24} />
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-base-content/5 opacity-0 transition group-hover:opacity-100">
              <Pencil size={14} />
            </span>
          </button>
          {iconOpen && (
            <div className="absolute left-0 top-[calc(100%+0.5rem)] z-20 flex w-80 flex-col gap-2 rounded-xl border border-base-300 bg-base-100 p-2 shadow-lg">
              <IconColorPicker
                icon={icon}
                color={color}
                onIconChange={chooseIcon}
                onColorChange={chooseColor}
                onCancel={cancelPicker}
                onDone={() => setIconOpen(false)}
                testIdPrefix="create-workspace"
              />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => setNameBlurred(true)}
            placeholder={t("workspace.name_label")}
            aria-label={t("workspace.name_label")}
            aria-invalid={nameBlurred && !name.trim()}
            aria-describedby="create-workspace-name-hint"
            className="w-full max-w-[32rem] border-b border-transparent bg-transparent px-0 text-lg font-semibold text-base-content outline-none placeholder:text-base-content/40 focus:border-accent"
            autoFocus
          />
          <p
            id="create-workspace-name-hint"
            data-testid="create-workspace-name-hint"
            className={`mt-2 min-h-[16px] min-w-0 text-[11px] ${
              nameBlurred && !name.trim()
                ? "text-error"
                : "text-base-content/60"
            }`}
          >
            {name.trim() ? "" : t("workspace.name_prompt")}
          </p>
        </div>
      </div>

      <WorkspaceStorageManager
        workspaceId={draftId}
        onOpenAddSource={(kind) => setAddSourceKind(kind ?? "local")}
      />

      <div className="flex shrink-0 items-center justify-end gap-2">
        {error ? (
          <p
            data-testid="create-workspace-error"
            className="mr-auto text-xs text-error"
          >
            {error}
          </p>
        ) : null}
        <button type="button" className="btn" onClick={cancel} disabled={busy}>
          {t("common.cancel")}
        </button>
        <button
          type="button"
          data-testid="create-workspace-create"
          className="btn btn-accent"
          onClick={create}
          disabled={!name.trim() || busy || !draftId}
        >
          {busy ? (
            <>
              <span className="loading loading-spinner loading-xs" />
              {t("workspace.create_applying")}
            </>
          ) : (
            t("workspace.create_workspace")
          )}
        </button>
      </div>
      {addSourceKind && (
        <AddSourceModal
          isOpen
          onClose={() => setAddSourceKind(null)}
          workspaceId={draftId}
          initialKind={addSourceKind}
        />
      )}
    </BaseModal>
  );
}
