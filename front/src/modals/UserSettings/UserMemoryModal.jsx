import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useSelector, useDispatch } from "react-redux";
import BaseModal from "../BaseModal";
import { useModal } from "../ModalContext";

import {
  addMemory,
  editMemory,
  deleteMemory,
  selectAllMemories,
  selectDefaultMemoryGroup,
  selectMemoryGroups,
  setMemoryGroup,
} from "../../Redux/reducers/userSettingsReducer";

export default function UserMemoryModal({
  isOpen,
  onClose,
  localState,
  notifySuccess,
  groupId = null,
}) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const allMemories = useSelector(selectAllMemories);
  const memoryGroups = useSelector(selectMemoryGroups);
  const defaultMemoryGroup = useSelector(selectDefaultMemoryGroup);
  const { openModal } = useModal();

  const memoryEntries = allMemories
    .map((memory, globalIndex) => ({ memory, globalIndex }))
    .filter(
      ({ memory }) =>
        !groupId || (memory.groupId ?? "default") === groupId,
    );
  const memories = memoryEntries.map(({ memory }) => memory);

  const groupOptions = [
    { id: "default", name: t("settings.memory_mode.default_group_name") },
    ...memoryGroups,
  ];

  const [newMemoryText, setNewMemoryText] = useState("");
  const [newMemoryGroup, setNewMemoryGroup] = useState(
    groupId ?? defaultMemoryGroup,
  );
  const [editingIndex, setEditingIndex] = useState(null);
  const [editText, setEditText] = useState("");

  // Add new memory
  const handleAddMemory = () => {
    if (newMemoryText.trim()) {
      dispatch(addMemory({ text: newMemoryText, groupId: newMemoryGroup }));
      setNewMemoryText("");
    }
  };

  // Start editing
  const startEditing = (globalIndex, memory) => {
    setEditingIndex(globalIndex);
    setEditText(memory.text);
  };

  // Save edit
  const handleEditMemory = (globalIndex) => {
    if (editText.trim()) {
      dispatch(editMemory({ index: globalIndex, text: editText }));
      setEditingIndex(null);
      setEditText("");
    }
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingIndex(null);
    setEditText("");
  };

  // Delete single memory
  const handleDeleteMemory = (globalIndex) => {
    dispatch(deleteMemory({ index: globalIndex }));
  };

  // Delete all memories
  const handleDeleteAll = () => {
    openModal("clearMemory", { localState });
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey="memory.userMemory"
      maxWidth="max-w-2xl"
    >
      {/* Memory count */}
      <p className="text-xs text-base-content/70 mb-2">
        <Trans
          i18nKey="memory.memoryCount"
          defaultValue="{{count}} memories stored"
          values={{ count: memories.length }}
        />
      </p>

      {/* Add New Memory */}
      <div className="p-4 border-b border-base-300 -mx-4 mb-4">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">
            <Trans
              i18nKey="memory.addNew"
              defaultValue="Add New Memory"
            />
          </p>
          <div className="flex gap-2">
            <textarea
              value={newMemoryText}
              onChange={(e) => setNewMemoryText(e.target.value)}
              placeholder="Enter new memory..."
              className="textarea flex-1 h-full text-sm"
              onKeyDown={(e) => e.key === "Enter" && handleAddMemory()}
            />
            <select
              value={newMemoryGroup}
              onChange={(event) => setNewMemoryGroup(event.target.value)}
              className="select select-bordered select-sm"
            >
              {groupOptions.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleAddMemory}
              disabled={!newMemoryText.trim()}
              className="btn btn-info btn-sm text-sm"
            >
              <Trans i18nKey="memory.add" defaultValue="Add" />
            </button>
          </div>
        </div>
      </div>

      {/* Saved Memories */}
      <div className="flex justify-between items-center mb-2">
        <p className="text-sm font-medium">
          <Trans
            i18nKey="memory.savedMemories"
            defaultValue="Saved Memories"
          />
        </p>
        {!groupId && memories.length > 0 && (
          <button
            onClick={handleDeleteAll}
            className="btn btn-xs btn-error"
          >
            <Trans
              i18nKey="memory.deleteAll"
              defaultValue="Delete All"
            />
          </button>
        )}
      </div>

      {/* Memory List */}
      <div className="max-h-96 overflow-y-auto">
        {memories.length === 0 ? (
          <div className="text-center py-8 text-base-content/70">
            <p className="text-sm">
              <Trans
                i18nKey="memory.noMemories"
                defaultValue="No memories saved yet."
              />
            </p>
            <p className="text-xs mt-1">
              <Trans
                i18nKey="memory.addFirst"
                defaultValue="Add your first memory above!"
              />
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {memoryEntries.map(({ memory, globalIndex }, displayIndex) => (
              <div
                key={memory.id}
                className="border border-base-300 rounded-lg p-3 bg-base-200"
              >
                <div className="flex items-start gap-3">
                  {/* Index number */}
                  <span className="text-xs font-medium text-info mt-1 flex-shrink-0">
                    {displayIndex + 1}
                  </span>

                  {editingIndex === globalIndex ? (
                    /* Edit Mode */
                    <div className="flex-1 flex flex-col gap-2">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="textarea w-full text-sm"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleEditMemory(globalIndex);
                          }
                        }}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditMemory(globalIndex)}
                          className="btn btn-xs btn-success"
                        >
                          <Trans
                            i18nKey="memory.save"
                            defaultValue="Save"
                          />
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="btn btn-xs btn-neutral"
                        >
                          <Trans
                            i18nKey="memory.cancel"
                            defaultValue="Cancel"
                          />
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* View Mode */
                    <div className="flex-1 flex flex-col gap-2">
                      <p className="text-base-content break-words text-sm">
                        {memory.text}
                      </p>
                      <label className="flex items-center gap-2 text-xs text-base-content/70">
                        <span>{t("memory.group")}</span>
                        <select
                          value={memory.groupId ?? "default"}
                          onChange={(event) =>
                            dispatch(
                              setMemoryGroup({
                                index: globalIndex,
                                groupId: event.target.value,
                              }),
                            )
                          }
                          className="select select-bordered select-xs min-w-0 flex-1"
                        >
                          {groupOptions.map((group) => (
                            <option key={group.id} value={group.id}>
                              {group.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-base-content/70">
                          <Trans
                            i18nKey="memory.created"
                            defaultValue="Created: {{date}}"
                            values={{
                              date: new Date(
                                memory.createdAt
                              ).toLocaleDateString(),
                            }}
                          />
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEditing(globalIndex, memory)}
                            className="btn btn-xs btn-info"
                          >
                            <Trans
                              i18nKey="memory.edit"
                              defaultValue="Edit"
                            />
                          </button>
                          <button
                            onClick={() => handleDeleteMemory(globalIndex)}
                            className="btn btn-xs btn-error"
                          >
                            <Trans
                              i18nKey="memory.delete"
                              defaultValue="Delete"
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </BaseModal>
  );
}