import { useState } from "react";
import { Trans } from "react-i18next";
import { useSelector, useDispatch } from "react-redux";

import ContainerModal from "./ContainerModal";
import cross from "../assets/cross.svg";
import {
  addMemory,
  editMemory,
  deleteMemory,
  selectAllMemories,
  deleteAllMemories,
} from "../Redux/reducers/userMemorySlice";

function UserMemoryModal(props) {
  const dispatch = useDispatch();
  const memories = useSelector(selectAllMemories);

  const [newMemoryText, setNewMemoryText] = useState("");
  const [editingIndex, setEditingIndex] = useState(null);
  const [editText, setEditText] = useState("");

  // Add new memory
  const handleAddMemory = () => {
    if (newMemoryText.trim()) {
      dispatch(addMemory({ text: newMemoryText }));
      setNewMemoryText("");
    }
  };

  // Start editing
  const startEditing = (index, memory) => {
    setEditingIndex(index);
    setEditText(memory.text);
  };

  // Save edit
  const handleEditMemory = (index) => {
    if (editText.trim()) {
      dispatch(editMemory({ index, text: editText }));
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
  const handleDeleteMemory = (index) => {
    dispatch(deleteMemory({ index }));
  };

  // Delete all memories
  const handleDeleteAll = () => {
    if (props.localState.dontShow.dontShowAgainMemory) {
      dispatch(deleteAllMemories());
    } else {
      props.setShowClearMemoryModal(true);
    }
  };

  return (
    <ContainerModal showModal={props.showModal} isMemoryModal={true}>
      <div className="select-none border dark:border-border_dark rounded-2xl bg-white dark:bg-black w-full max-w-2xl">
        {/* Modal Header */}
        <div className="flex justify-between items-center px-4 pt-4">
          <div className="flex flex-col">
            <p className="text-sm text-tertiary font-medium">
              <Trans
                i18nKey="description.memory.userMemory"
                defaultValue="User Memory"
              />
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              <Trans
                i18nKey="description.memory.memoryCount"
                defaultValue="{{count}} memories stored"
                values={{ count: memories.length }}
              />
            </p>
          </div>
          <img
            src={cross}
            alt="cross"
            className="h-[24px] w-[24px] cursor-pointer p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            onClick={() => props.showModal(false)}
          />
        </div>

        {/* Add New Memory Section */}
        <div className="p-4 border-b dark:border-border_dark">
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium dark:text-white">
              <Trans
                i18nKey="description.memory.addNew"
                defaultValue="Add New Memory"
              />
            </p>
            <div className="flex gap-2">
              <div className="flex-1 rounded-lg">
                <textarea
                  type="text"
                  value={newMemoryText}
                  onChange={(e) => setNewMemoryText(e.target.value)}
                  placeholder="Enter new memory..."
                  className="w-full px-3 py-2 h-full border dark:border-border_dark rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  onKeyDown={(e) => e.key === "Enter" && handleAddMemory()}
                />
              </div>
              <button
                onClick={handleAddMemory}
                disabled={!newMemoryText.trim()}
                className="h-fit px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg transition-colors disabled:cursor-not-allowed text-sm"
              >
                <Trans i18nKey="description.memory.add" defaultValue="Add" />
              </button>
            </div>
          </div>
        </div>

        {/* Memory List Section */}
        <div className="p-4 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <p className="text-sm font-medium dark:text-white">
              <Trans
                i18nKey="description.memory.savedMemories"
                defaultValue="Saved Memories"
              />
            </p>
            {memories.length > 0 && (
              <button
                onClick={handleDeleteAll}
                className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                <Trans
                  i18nKey="description.memory.deleteAll"
                  defaultValue="Delete All"
                />
              </button>
            )}
          </div>

          {/* Memory List */}
          <div className="max-h-96 overflow-y-auto">
            {memories.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p className="text-sm">
                  <Trans
                    i18nKey="description.memory.noMemories"
                    defaultValue="No memories saved yet."
                  />
                </p>
                <p className="text-xs mt-1">
                  <Trans
                    i18nKey="description.memory.addFirst"
                    defaultValue="Add your first memory above!"
                  />
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {memories.map((memory, index) => (
                  <div
                    key={memory.id}
                    className="border dark:border-border_dark rounded-lg p-3 bg-gray-50 dark:bg-gray-800/50"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400 mt-1 flex-shrink-0">
                        {index + 1}
                      </span>

                      {editingIndex === index ? (
                        // Edit Mode
                        <div className="flex-1 flex flex-col gap-2">
                          <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="w-full px-3 py-2 border dark:border-border_dark rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleEditMemory(index);
                              }
                            }}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditMemory(index)}
                              className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                            >
                              <Trans
                                i18nKey="description.memory.save"
                                defaultValue="Save"
                              />
                            </button>
                            <button
                              onClick={cancelEditing}
                              className="px-3 py-1 text-xs bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
                            >
                              <Trans
                                i18nKey="description.memory.cancel"
                                defaultValue="Cancel"
                              />
                            </button>
                          </div>
                        </div>
                      ) : (
                        // View Mode
                        <div className="flex-1 flex flex-col gap-2">
                          <p className="text-gray-900 dark:text-white break-words text-sm">
                            {memory.text}
                          </p>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              <Trans
                                i18nKey="description.memory.created"
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
                                onClick={() => startEditing(index, memory)}
                                className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                              >
                                <Trans
                                  i18nKey="description.memory.edit"
                                  defaultValue="Edit"
                                />
                              </button>
                              <button
                                onClick={() => handleDeleteMemory(index)}
                                className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                              >
                                <Trans
                                  i18nKey="description.memory.delete"
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
        </div>
      </div>
    </ContainerModal>
  );
}

export default UserMemoryModal;
