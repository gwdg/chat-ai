import React, { useState, useEffect } from "react";
import { Trans } from "react-i18next";
import BaseModal from "../../modals/BaseModal";
import { useImportConversation } from "../../hooks/useImportConversation";
import i18n from "../../i18n";
import { useToast } from "../../hooks/useToast";
import {
  deleteCustomPersona,
  renameCustomPersonaTitle,
  useCustomPersonaList,
} from "../../db";
import {
  Folder,
  FolderOpen,
  Bot,
  Check,
  Menu,
  Pencil,
  Trash2,
  X,
} from "lucide-react";

export default function ImportPersonaModal({
  isOpen,
  onClose,
  onFileSelect,
  onError,
  repoOwner = "gwdg",
  repoName = "chat-ai-personas",
  branch = "main",
}) {
  const [selectedPath, setSelectedPath] = useState(null);
  const [rootContents, setRootContents] = useState({ folders: [], files: [] });
  const [currentFolderContents, setCurrentFolderContents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingFolder, setLoadingFolder] = useState(false);
  const [error, setError] = useState(null);
  const [folderStructure, setFolderStructure] = useState({});
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editingPersonaId, setEditingPersonaId] = useState(null);
  const [editingPersonaTitle, setEditingPersonaTitle] = useState("");
  const [pendingDeletePersona, setPendingDeletePersona] = useState(null);

  const { notifySuccess, notifyError } = useToast();
  const importConversation = useImportConversation();
  const customPersonas = useCustomPersonaList() || [];

  // Fetch root contents and organize into folders and files
  const fetchRootContents = async () => {
    setLoading(true);
    setError(null);

    try {
      const url = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/?ref=${branch}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }

      const data = await response.json();

      // Filter & categorize
      const folders = [];
      const files = [];

      for (const item of data) {
        if (
          item.name.toLowerCase().includes("license") ||
          item.name.toLowerCase().includes("readme")
        )
          continue;

        if (item.type === "dir") {
          folders.push(item);
        } else if (
          item.type === "file" &&
          item.name.toLowerCase().endsWith(".json")
        ) {
          // Fetch file metadata
          try {
            const resp = await fetch(item.download_url);
            if (resp.ok) {
              const text = await resp.text();
              const cleaned = text.replace(/,(\s*[}$])/g, "$1");
              const parsed = JSON.parse(cleaned);
              files.push({
                ...item,
                title: parsed.title || item.name.replace(".json", ""),
                subtitle:
                  parsed.subtitle ||
                  `Configuration • ${formatFileSize(item.size)}`,
              });
            } else {
              files.push({
                ...item,
                title: item.name.replace(".json", ""),
                subtitle: `Configuration • ${formatFileSize(item.size)}`,
              });
            }
          } catch {
            files.push({
              ...item,
              title: item.name.replace(".json", ""),
              subtitle: `Configuration • ${formatFileSize(item.size)}`,
            });
          }
        }
      }

      // Sort alphabetically
      folders.sort((a, b) => a.name.localeCompare(b.name));
      files.sort((a, b) =>
        (a.title || a.name).localeCompare(b.title || b.name)
      );

      setRootContents({ folders, files });
    } catch (err) {
      setError(err.message);
      setRootContents({ folders: [], files: [] });
    } finally {
      setLoading(false);
    }
  };

  // Fetch folder contents
  const fetchFolderContents = async (path) => {
    setLoadingFolder(true);
    setError(null);

    try {
      const url = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${path}?ref=${branch}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }

      const data = await response.json();

      // Filter and process files
      const files = [];

      for (const item of data) {
        if (item.type === "file" && item.name.toLowerCase().endsWith(".json")) {
          // Fetch file metadata
          try {
            const resp = await fetch(item.download_url);
            if (resp.ok) {
              const text = await resp.text();
              const cleaned = text.replace(/,(\s*[}$])/g, "$1");
              const parsed = JSON.parse(cleaned);
              files.push({
                ...item,
                title: parsed.title || item.name.replace(".json", ""),
                subtitle:
                  parsed.subtitle ||
                  `Configuration • ${formatFileSize(item.size)}`,
              });
            } else {
              files.push({
                ...item,
                title: item.name.replace(".json", ""),
                subtitle: `Configuration • ${formatFileSize(item.size)}`,
              });
            }
          } catch {
            files.push({
              ...item,
              title: item.name.replace(".json", ""),
              subtitle: `Configuration • ${formatFileSize(item.size)}`,
            });
          }
        }
      }

      files.sort((a, b) =>
        (a.title || a.name).localeCompare(b.title || b.name)
      );
      setCurrentFolderContents(files);

      // Cache the folder contents
      setFolderStructure((prev) => ({
        ...prev,
        [path]: files,
      }));
    } catch (err) {
      setError(err.message);
      setCurrentFolderContents([]);
    } finally {
      setLoadingFolder(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRootContents();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedPath(null);
      setRootContents({ folders: [], files: [] });
      setCurrentFolderContents([]);
      setFolderStructure({});
      setError(null);
      setSidebarOpen(false);
      setEditingPersonaId(null);
      setEditingPersonaTitle("");
      setPendingDeletePersona(null);
    }
  }, [isOpen]);

  const handleFolderClick = (folder) => {
    // If clicking the same folder, toggle visibility
    if (selectedPath === folder.path) {
      setSelectedPath(null);
      setCurrentFolderContents([]);
    } else {
      setSelectedPath(folder.path);
      setSidebarOpen(false); // Close sidebar on mobile after selection

      // Fetch contents if not cached
      if (!folderStructure[folder.path]) {
        fetchFolderContents(folder.path);
      } else {
        setCurrentFolderContents(folderStructure[folder.path]);
      }
    }
  };

  const handleFileImport = async (file) => {
    try {
      setLoading(true);
      const resp = await fetch(file.download_url);
      if (!resp.ok) {
        throw new Error(
          resp.status >= 500
            ? "Server Error: Please try again later."
            : "Client Error: The provided link might be incorrect."
        );
      }
      const rawText = await resp.text();
      const cleaned = rawText.replace(/,(\s*[}$])/g, "$1");
      const parsed = JSON.parse(cleaned);

      await importConversation(parsed);
      onClose();
    } catch (err) {
      console.error("Import error:", err);
      if (onError) onError("Failed to import persona");
    } finally {
      setLoading(false);
    }
  };

  const handleInsertFromClipboard = async () => {
    try {
      if (!navigator?.clipboard?.readText) {
        throw new Error("Clipboard API not available in this context.");
      }
      setLoading(true);
      const raw = await navigator.clipboard.readText();
      if (!raw?.trim()) throw new Error("Clipboard is empty.");

      const cleaned = raw.replace(/,(\s*[}$])/g, "$1");
      let parsed;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        throw new Error(
          i18n.t("persona.importFromClipboardErrorInvalidJson")
        );
      }
      try {
        await importConversation(parsed);
      } catch (err) {
        console.error("Import error:", err);
        throw new Error(
          i18n.t("persona.importFromClipboardErrorInvalidPersona")
        );
      }

      onClose();
    } catch (err) {
      console.error("Clipboard import error:", err);
      const msg = err?.message || "Failed to import persona from clipboard.";
      onError
        ? onError(msg)
        : notifyError(
            i18n.t("persona.importFromClipboardErrorInvalidJson")
          );
    } finally {
      setLoading(false);
    }
  };

  const handleLocalPersonaImport = async (persona) => {
    if (!persona?.payload) return;
    try {
      setLoading(true);
      await importConversation(persona.payload);
      onClose();
    } catch (err) {
      console.error("Local persona import error:", err);
      onError
        ? onError(i18n.t("persona.customPersonaImportError"))
        : notifyError(i18n.t("persona.customPersonaImportError"));
    } finally {
      setLoading(false);
    }
  };

  const startRenameCustomPersona = (persona) => {
    if (!persona?.id) return;
    setEditingPersonaId(persona.id);
    setEditingPersonaTitle(persona.title || "");
  };

  const cancelRenameCustomPersona = () => {
    setEditingPersonaId(null);
    setEditingPersonaTitle("");
  };

  const saveRenameCustomPersona = async (personaId) => {
    const trimmed = editingPersonaTitle.trim();
    if (!trimmed) {
      notifyError(i18n.t("persona.customPersonaRenameRequired"));
      return;
    }

    try {
      await renameCustomPersonaTitle(personaId, trimmed);
      notifySuccess(
        i18n.t("persona.customPersonaRenameSuccess", {
          title: trimmed,
        })
      );
      cancelRenameCustomPersona();
    } catch (err) {
      console.error("Custom persona rename error:", err);
      notifyError(i18n.t("persona.customPersonaRenameError"));
    }
  };

  const openDeleteCustomPersona = (persona) => {
    if (!persona?.id) return;
    setPendingDeletePersona(persona);
  };

  const closeDeleteCustomPersona = () => {
    setPendingDeletePersona(null);
  };

  const confirmDeleteCustomPersona = async () => {
    if (!pendingDeletePersona?.id) return;

    try {
      await deleteCustomPersona(pendingDeletePersona.id);
      if (editingPersonaId === pendingDeletePersona.id) {
        cancelRenameCustomPersona();
      }
      closeDeleteCustomPersona();
      notifySuccess(i18n.t("persona.customPersonaDeleteSuccess"));
    } catch (err) {
      console.error("Custom persona delete error:", err);
      notifyError(i18n.t("persona.customPersonaDeleteError"));
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const renderSidebarFile = (file) => (
    <div
      key={file.sha}
      onClick={() => handleFileImport(file)}
      className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer rounded transition-colors group"
    >
      <Bot className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
      <span className="text-xs text-gray-700 dark:text-gray-300 truncate flex-1">
        {file.title || file.name.replace(".json", "")}
      </span>
    </div>
  );

  const renderContentGrid = () => {
    if (loadingFolder) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      );
    }

    if (!selectedPath) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
          <Folder className="w-16 h-16 mb-4 text-gray-300 dark:text-gray-600" />
          <p className="text-sm font-medium">
            <Trans i18nKey="persona.selectFolder" />
          </p>
          <p className="text-xs mt-2 text-center px-4">
            <Trans i18nKey="persona.selectFolderDescription" />
          </p>
        </div>
      );
    }

    if (currentFolderContents.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
          <FolderOpen className="w-16 h-16 mb-4 text-gray-300 dark:text-gray-600" />
          <p className="text-sm">
            <Trans i18nKey="persona.emptyFolder" />
          </p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 p-4">
        {currentFolderContents.map((file) => (
          <div
            key={file.sha}
            onClick={() => handleFileImport(file)}
            className="flex flex-col items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg cursor-pointer transition-all hover:shadow-md group"
          >
            <Bot className="w-10 h-10 mb-2 text-blue-500 dark:text-blue-400 group-hover:scale-110 transition-transform" />
            <p className="text-xs font-medium text-gray-900 dark:text-white text-center line-clamp-2">
              {file.title}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center line-clamp-1">
              {file.subtitle}
            </p>
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey={null}
      maxWidth="max-w-4xl"
    >
      {/* Header */}
      <div className="flex justify-between items-center px-4 sm:px-6 py-4 border-b dark:border-gray-700">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="sm:hidden p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
          >
            <Menu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
              <Trans i18nKey="persona.personaLibrary" />
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              <Trans i18nKey="persona.browsePersonas" />
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex h-[400px] sm:h-[450px] relative overflow-hidden">
        {/* Sidebar */}
        <div
          className={`
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          sm:translate-x-0 transition-transform duration-200 ease-in-out
          absolute sm:relative z-50 sm:z-auto
          w-56 sm:w-60 h-full
          border-r dark:border-gray-700 
          bg-gray-50 dark:bg-gray-900 
          overflow-y-auto
        `}
        >
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <div className="p-3">
              {/* Folders Section */}
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2 px-1">
                  <Trans i18nKey="persona.categories" />
                </h3>
                {rootContents.folders.map((folder) => (
                  <div
                    key={folder.sha}
                    onClick={() => handleFolderClick(folder)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer transition-colors ${
                      selectedPath === folder.path
                        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                        : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {selectedPath === folder.path ? (
                      <FolderOpen className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0" />
                    ) : (
                      <Folder className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0" />
                    )}
                    <span className="text-xs font-medium truncate flex-1">
                      {folder.name}
                    </span>
                  </div>
                ))}
              </div>

              {/* Direct Files Section */}
              {rootContents.files.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2 px-1">
                    <Trans i18nKey="persona.quickImport" />
                  </h3>
                  {rootContents.files.map(renderSidebarFile)}
                </div>
              )}

              <div className="mt-4">
                <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2 px-1">
                  <Trans i18nKey="persona.customPersonas" />
                </h3>
                {customPersonas.length === 0 ? (
                  <p className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <Trans i18nKey="persona.customPersonaEmpty" />
                  </p>
                ) : (
                  customPersonas.map((persona) => {
                    const isEditing = editingPersonaId === persona.id;
                    return (
                      <div
                        key={persona.id}
                        onClick={() => {
                          if (isEditing) return;
                          handleLocalPersonaImport(persona);
                        }}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded transition-colors group ${
                          isEditing
                            ? "bg-blue-50 dark:bg-blue-900/20"
                            : "hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                        }`}
                      >
                        <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />

                        <div className="min-w-0 flex-1">
                          {isEditing ? (
                            <input
                              value={editingPersonaTitle}
                              onChange={(event) => setEditingPersonaTitle(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  saveRenameCustomPersona(persona.id);
                                } else if (event.key === "Escape") {
                                  event.preventDefault();
                                  cancelRenameCustomPersona();
                                }
                              }}
                              className="w-full text-xs px-2 py-1 rounded border border-blue-300 dark:border-blue-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
                              autoFocus
                            />
                          ) : (
                            <>
                              <p className="text-xs text-gray-700 dark:text-gray-300 truncate">
                                {persona.title}
                              </p>
                              {persona.sourceConversationTitle && (
                                <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                                  {persona.sourceConversationTitle}
                                </p>
                              )}
                            </>
                          )}
                        </div>

                        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  saveRenameCustomPersona(persona.id);
                                }}
                                className="p-1 rounded hover:bg-green-100 dark:hover:bg-green-900/40 text-green-600 dark:text-green-400 transition"
                                title={i18n.t("common.save")}
                                aria-label={i18n.t("common.save")}
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  cancelRenameCustomPersona();
                                }}
                                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition"
                                title={i18n.t("common.cancel")}
                                aria-label={i18n.t("common.cancel")}
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  startRenameCustomPersona(persona);
                                }}
                                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition"
                                title={i18n.t("common.rename")}
                                aria-label={i18n.t("common.rename")}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openDeleteCustomPersona(persona);
                                }}
                                className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 transition"
                                title={i18n.t("common.delete")}
                                aria-label={i18n.t("common.delete")}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-white dark:bg-gray-900 overflow-y-auto relative">
          {/* Mobile Sidebar Overlay - only on content area */}
          {sidebarOpen && (
            <div
              className="sm:hidden absolute inset-0 bg-transparent backdrop-blur-md bg-opacity-45 dark:bg-opacity-30 z-40"
              onClick={() => setSidebarOpen(false)}
            />
          )}
          {renderContentGrid()}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 sm:px-6 py-3 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
          <div className="flex gap-3">
            <button
              onClick={handleInsertFromClipboard}
              disabled={loading}
              className="cursor-pointer px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-xs"
            >
              <Trans i18nKey="persona.importFromClipboard" />
            </button>
            <button
              onClick={() =>
                window.open(
                  `https://github.com/${repoOwner}/${repoName}`,
                  "_blank"
                )
              }
              className="cursor-pointer px-3 py-1.5 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors text-xs"
            >
              <Trans i18nKey="persona.createOwn" />
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <Trans
              i18nKey="persona.categoryCount"
              values={{
                folders: rootContents.folders.length,
                files: rootContents.files.length,
              }}
            />
          </p>
        </div>
      </div>
    </BaseModal>
    <BaseModal
      isOpen={Boolean(pendingDeletePersona)}
      onClose={closeDeleteCustomPersona}
      titleKey="persona.customPersonaDeleteTitle"
      maxWidth="max-w-md"
    >
      <div className="space-y-4 text-sm">
        <p className="text-gray-700 dark:text-gray-200">
          <Trans
            i18nKey="persona.customPersonaDeleteConfirm"
            values={{
              title:
                pendingDeletePersona?.title ||
                i18n.t("conversation.untitled", {
                  defaultValue: "Untitled Conversation",
                }),
            }}
          />
        </p>
        <div className="flex flex-col md:flex-row gap-2 justify-end">
          <button
            className="cursor-pointer px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            onClick={closeDeleteCustomPersona}
          >
            <Trans i18nKey="common.cancel" />
          </button>
          <button
            className="cursor-pointer px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition shadow"
            onClick={confirmDeleteCustomPersona}
          >
            <Trans i18nKey="common.delete" />
          </button>
        </div>
      </div>
    </BaseModal>
    </>
  );
}
