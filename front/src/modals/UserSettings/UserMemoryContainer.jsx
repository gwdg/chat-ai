import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import {
  Brain,
  Check,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import { newId } from "../../db";
import {
  addMemoryGroup,
  deleteMemoryGroup,
  renameMemoryGroup,
  selectAllMemories,
  selectDefaultMemoryGroup,
  selectMemoryGroups,
  setDefaultMemoryGroup,
} from "../../Redux/reducers/userSettingsReducer";
import { useModal } from "../ModalContext";

export default function UserMemoryContainer({ localState }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const memories = useSelector(selectAllMemories);
  const groups = useSelector(selectMemoryGroups);
  const defaultGroup = useSelector(selectDefaultMemoryGroup);
  const { openModal } = useModal();

  const [showAdd, setShowAdd] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");

  const allGroups = [
    { id: "default", name: t("user_settings.memory.groups.default_name") },
    ...groups,
  ];

  const countForGroup = (groupId) =>
    memories.filter((memory) => (memory.groupId ?? "default") === groupId)
      .length;

  const handleAdd = () => {
    const name = newGroupName.trim();
    if (!name) return;
    dispatch(addMemoryGroup({ id: newId(), name }));
    setNewGroupName("");
    setShowAdd(false);
  };

  const startRename = (group) => {
    setEditingId(group.id);
    setEditName(group.name);
  };

  const saveRename = (groupId) => {
    const name = editName.trim();
    if (!name) return;
    dispatch(renameMemoryGroup({ id: groupId, name }));
    setEditingId(null);
    setEditName("");
  };

  return (
    <section className="flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-accent" aria-hidden="true" />
          <h3 className="text-sm font-medium text-base-content">
            {t("user_settings.memory.title")}
          </h3>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-base-content/70">
          {t("user_settings.memory.description", { count: memories.length })}
        </p>
      </div>

      <div className="flex flex-col gap-1">
        {allGroups.map((group) => (
          <div
            key={group.id}
            className="flex min-h-11 items-center gap-2 rounded-lg border border-base-300 px-2.5 py-1.5"
          >
            {editingId === group.id ? (
              <>
                <input
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      saveRename(group.id);
                    }
                    if (event.key === "Escape") {
                      setEditingId(null);
                    }
                  }}
                  autoFocus
                  className="min-w-0 flex-1 rounded-md border border-base-300 bg-base-100 px-2 py-1 text-xs text-base-content focus:border-accent focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => saveRename(group.id)}
                  aria-label={t("memory.save")}
                  title={t("memory.save")}
                  className="rounded-md p-1 text-success transition hover:bg-success/10"
                >
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  aria-label={t("memory.cancel")}
                  title={t("memory.cancel")}
                  className="rounded-md p-1 text-base-content/70 transition hover:bg-base-200"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() =>
                    openModal("userMemory", {
                      localState,
                      groupId: group.id,
                    })
                  }
                  title={t("user_settings.memory.manage")}
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-base-content">
                    {group.name}
                  </span>
                  {group.id === defaultGroup && (
                    <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
                      {t("user_settings.memory.groups.default_badge")}
                    </span>
                  )}
                  <span className="rounded-full bg-base-200 px-2 py-0.5 text-xs font-semibold tabular-nums text-base-content/70">
                    {countForGroup(group.id)}
                  </span>
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-base-content/50"
                    aria-hidden="true"
                  />
                </button>
                {group.id !== "default" && (
                  <>
                    <button
                      type="button"
                      onClick={() => startRename(group)}
                      aria-label={t("user_settings.memory.groups.rename")}
                      title={t("user_settings.memory.groups.rename")}
                      className="rounded-md p-1 text-base-content/70 transition hover:bg-base-200"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        dispatch(deleteMemoryGroup({ id: group.id }))
                      }
                      aria-label={t("user_settings.memory.groups.delete")}
                      title={t("user_settings.memory.groups.delete")}
                      className="rounded-md p-1 text-error transition hover:bg-error/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      <label className="flex items-center gap-2">
        <span className="shrink-0 text-xs font-medium text-base-content">
          {t("user_settings.memory.groups.default_label")}
        </span>
        <select
          value={defaultGroup}
          onChange={(event) =>
            dispatch(setDefaultMemoryGroup(event.target.value))
          }
          className="min-w-0 flex-1 rounded-md border border-base-300 bg-base-100 px-2 py-1.5 text-xs text-base-content focus:border-accent focus:outline-none"
        >
          {allGroups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </label>

      {showAdd ? (
        <div className="flex gap-2">
          <input
            value={newGroupName}
            onChange={(event) => setNewGroupName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleAdd();
              }
              if (event.key === "Escape") {
                setShowAdd(false);
                setNewGroupName("");
              }
            }}
            autoFocus
            placeholder={t("user_settings.memory.groups.name_placeholder")}
            className="min-w-0 flex-1 rounded-md border border-base-300 bg-base-100 px-2 py-1.5 text-xs text-base-content placeholder:text-base-content/50 focus:border-accent focus:outline-none"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!newGroupName.trim()}
            className="flex shrink-0 cursor-pointer items-center gap-1 rounded-md bg-accent px-2 py-1.5 text-xs font-medium text-accent-content transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            {t("user_settings.memory.groups.add")}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowAdd(false);
              setNewGroupName("");
            }}
            aria-label={t("memory.cancel")}
            title={t("memory.cancel")}
            className="shrink-0 rounded-md border border-base-300 px-2 py-1.5 text-base-content/70 transition hover:bg-base-200"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="flex min-h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-base-300 px-3 py-2 text-xs font-medium text-base-content/70 transition hover:border-accent hover:text-accent"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          {t("user_settings.memory.groups.add")}
        </button>
      )}
    </section>
  );
}
