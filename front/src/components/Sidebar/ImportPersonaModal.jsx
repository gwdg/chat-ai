import React, { useState, useEffect } from "react";
import { Trans } from "react-i18next";
import BaseModal from "../../modals/BaseModal";
import icon_arrow_left from "../../assets/icons/arrow_left.svg";
import { useImportConversation } from "../../hooks/useImportConversation";
import i18n from '../../i18n';


import { useToast } from "../../hooks/useToast";
export default function ImportPersonaModal({
  isOpen,
  onClose,
  onFileSelect,
  onError,
  repoOwner = "gwdg",
  repoName = "chat-ai-personas",
  branch = "main"
}) {
  const [currentPath, setCurrentPath] = useState("");
  const [contents, setContents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pathHistory, setPathHistory] = useState([]);
  const { notifySuccess, notifyError } = useToast();
  
  const importConversation = useImportConversation();

  const handleImportPersona = async (parsedData) => {
    return importConversation(
      parsedData
    );
  };

  const fetchContents = async (path = "") => {
    setLoading(true);
    setError(null);

    try {
      const url = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${path}?ref=${branch}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }

      const data = await response.json();

      // Filter & sort 
      const filteredData = data.filter((item) => {
        if (
          item.name.toLowerCase().includes("license") ||
          item.name.toLowerCase().includes("readme")
        ) return false;
        if (item.type === "dir") return true;
        if (item.type === "file") return item.name.toLowerCase().endsWith(".json");
        return false;
      });

      const sortedData = filteredData.sort((a, b) => {
        if (a.type === "dir" && b.type !== "dir") return -1;
        if (a.type !== "dir" && b.type === "dir") return 1;
        return a.name.localeCompare(b.name);
      });

      // Files: fetch JSON titles
      const fileItems = sortedData.filter((item) => item.type === "file");
      const dirItems = sortedData.filter((item) => item.type === "dir");

      const filePromises = fileItems.map(async (item) => {
        try {
          const resp = await fetch(item.download_url);
          if (!resp.ok) return { ...item, title: null, subtitle: null };
          const text = await resp.text();
          const cleaned = text.replace(/,(\s*[}$$])/g, "$1");
          const parsed = JSON.parse(cleaned);
          return { ...item, title: parsed.title || null, subtitle: parsed.subtitle || null };
        } catch {
          return { ...item, title: null, subtitle: null };
        }
      });

      const filesWithTitle = await Promise.all(filePromises);
      setContents([...dirItems, ...filesWithTitle]);
    } catch (err) {
      setError(err.message);
      setContents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchContents(currentPath);
  }, [currentPath, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setCurrentPath("");
      setPathHistory([]);
      setContents([]);
      setError(null);
    }
  }, [isOpen]);

  const handleItemClick = async (item) => {
    if (item.type === "dir") {
      setPathHistory([...pathHistory, currentPath]);
      setCurrentPath(item.path);
    } else {
      try {
        setLoading(true);
        const resp = await fetch(item.download_url);
        if (!resp.ok) {
          throw new Error(resp.status >= 500
            ? "Server Error: Please try again later."
            : "Client Error: The provided link might be incorrect.");
        }
        const rawText = await resp.text();
        const cleaned = rawText.replace(/,(\s*[}$])/g, "$1");
        const parsed = JSON.parse(cleaned);

        await importConversation(parsed);

        /*
        if (handleImportPersona) {
          onClose();
          await handleImportPersona(parsed, item.name.replace(".json", ""));
        } else if (onFileSelect) {
          onFileSelect(item, parsed);
        } else {
          window.open(item.html_url, "_blank");
        }
          */
      } catch (err) {
        console.error("Import error:", err);
        if (onError) onError("Failed to import persona");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleBackClick = () => {
    if (pathHistory.length > 0) {
      const prevPath = pathHistory[pathHistory.length - 1];
      setPathHistory(pathHistory.slice(0, -1));
      setCurrentPath(prevPath);
    }
  };

  const getFileIcon = (name, type) => {
    return type === "dir" 
      ? <span className="text-blue-500 text-xl">📁</span>
      : <span className="text-green-600 text-xl">🤖</span>;
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const breadcrumbs = currentPath ? currentPath.split("/") : [];

  // ADD below other handlers
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
        throw new Error(i18n.t("description.persona.importFromClipboardErrorInvalidJson"));
      }
      try {
        await importConversation(parsed);
      } catch (err) {
        console.error("Import error:", err);
        throw new Error(i18n.t("description.persona.importFromClipboardErrorInvalidPersona"));
      }
      
      onClose(); // match file import flow
      //notifySuccess?.("Persona imported from clipboard.");
    } catch (err) {
      console.error("Clipboard import error:", err);
      const msg = err?.message || "Failed to import persona from clipboard.";
      onError ? onError(msg) : notifyError(i18n.t("description.persona.importFromClipboardErrorInvalidJson"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey={null}
      maxWidth="max-w-4xl"
    >
      {/* Header row with icon & close built-in */}
      <div className="flex justify-between items-center px-4 pt-4">
        <div className="flex items-center gap-3">
          <span className="text-lg">⚙️</span>
          <div>
            <p className="text-sm text-tertiary font-medium">
              <Trans i18nKey="description.persona.selectPersona" />
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              <Trans i18nKey="description.persona.browsePersonas" />
            </p>
          </div>
        </div>
      </div>

      {/* Navigation bar */}
      {(pathHistory.length > 0 || currentPath) && (
        <div className="px-4 py-3 border-b dark:border-border_dark">
          <div className="flex items-center gap-2">
            {pathHistory.length > 0 && (
              <button
                onClick={handleBackClick}
                className="cursor-pointer flex items-center gap-1 px-3 py-1 text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors text-gray-700 dark:text-white"
              >
                <img src={icon_arrow_left} alt="" className="h-3 w-3" />
                <Trans i18nKey="description.persona.back" />
              </button>
            )}
            <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
              <span className="font-medium">
                <Trans i18nKey="description.persona.personas" />
              </span>
              {breadcrumbs.map((part, idx) => (
                <React.Fragment key={idx}>
                  <span className="mx-1">/</span>
                  <span className="font-medium">{part}</span>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="min-h-96 max-h-96 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        )}
        {error && (
          <div className="p-4 text-center">
            <div className="text-red-500 mb-2 dark:text-red-400 text-sm">
              <Trans i18nKey="description.persona.errorLoading" />
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-3">
              {error}
            </div>
            <button
              onClick={() => fetchContents(currentPath)}
              className="cursor-pointer px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors text-xs"
            >
              <Trans i18nKey="description.persona.retry" />
            </button>
          </div>
        )}
        {!loading && !error && contents.length === 0 && (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
            <Trans i18nKey="description.persona.noPersonas" />
          </div>
        )}
        {!loading && !error && contents.length > 0 && (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {contents.map((item) => (
              <div
                key={item.sha}
                onClick={() => handleItemClick(item)}
                className="flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-3 flex-1">
                  {getFileIcon(item.name, item.type)}
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors text-sm">
                      {item.type === "file"
                        ? item.title || item.name.replace(".json", "")
                        : item.name}
                    </div>
                    {item.type === "file" && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {item.subtitle ? (
                          item.subtitle
                        ) : (
                          <>
                            <Trans i18nKey="description.persona.configuration" />{" "}
                            • {formatFileSize(item.size)}
                          </>
                        )}
                      </div>
                    )}
                    {item.type === "dir" && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        <Trans i18nKey="description.persona.folder" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t dark:border-border_dark text-xs text-gray-600 dark:text-gray-400">
        <div className="flex justify-center gap-2">
          <button
            onClick={handleInsertFromClipboard}
            disabled={loading}
            className="cursor-pointer px-4 py-2 bg-tertiary hover:bg-blue-600 text-white rounded-lg transition-colors text-xs"
          >
            <Trans i18nKey="description.persona.importFromClipboard" />
          </button>
          <button
            onClick={() =>
              window.open(
                `https://github.com/${repoOwner}/${repoName}`,
                "_blank"
              )
            }
            className="cursor-pointer px-4 py-2 bg-tertiary hover:bg-blue-600 text-white rounded-lg transition-colors text-xs"
          >
            <Trans i18nKey="description.persona.createOwn" />
          </button>
        </div>
      </div>
    </BaseModal>
  );
}