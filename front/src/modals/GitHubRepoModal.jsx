import React, { useState, useEffect } from "react";
import { Trans } from "react-i18next";
import ContainerModal from "./ContainerModal";
import cross from "../assets/cross.svg";

function GitHubRepoModal(props) {
  const [currentPath, setCurrentPath] = useState("");
  const [contents, setContents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pathHistory, setPathHistory] = useState([]);

  // Repository configuration - you can pass these as props
  const REPO_OWNER = props.repoOwner || "gwdg";
  const REPO_NAME = props.repoName || "chat-ai-personas";
  const BRANCH = props.branch || "main";

  const fetchContents = async (path = "") => {
    setLoading(true);
    setError(null);

    try {
      const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}?ref=${BRANCH}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }

      const data = await response.json();

      // Filter out LICENSE and README files, and non-JSON files
      const filteredData = data.filter((item) => {
        // Skip LICENSE and README files
        if (
          item.name.toLowerCase().includes("license") ||
          item.name.toLowerCase().includes("readme")
        ) {
          return false;
        }

        // If it's a directory, keep it
        if (item.type === "dir") {
          return true;
        }

        // If it's a file, only keep JSON files
        if (item.type === "file") {
          return item.name.toLowerCase().endsWith(".json");
        }

        return false;
      });

      // Sort: directories first, then files, both alphabetically
      const sortedData = filteredData.sort((a, b) => {
        if (a.type === "dir" && b.type !== "dir") return -1;
        if (a.type !== "dir" && b.type === "dir") return 1;
        return a.name.localeCompare(b.name);
      });

      setContents(sortedData);
    } catch (err) {
      setError(err.message);
      setContents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (props.showModal) {
      fetchContents(currentPath);
    }
  }, [currentPath, props.showModal]);

  // Reset state when modal closes
  useEffect(() => {
    if (!props.showModal) {
      setCurrentPath("");
      setPathHistory([]);
      setContents([]);
      setError(null);
    }
  }, [props.showModal]);

  const handleItemClick = async (item) => {
    if (item.type === "dir") {
      setPathHistory([...pathHistory, currentPath]);
      setCurrentPath(item.path);
    } else {
      // Handle JSON file selection - import the persona
      try {
        setLoading(true);

        // Get the raw file URL for direct download
        const rawUrl = item.download_url;
        const response = await fetch(rawUrl);

        if (!response.ok) {
          throw new Error(
            response.status >= 500
              ? "Server Error: Please try again later."
              : "Client Error: The provided link might be incorrect."
          );
        }

        const parsedData = await response.json();

        // Call the provided import handler if available
        if (props.onPersonaImport) {
          await props.onPersonaImport(
            parsedData,
            item.name.replace(".json", "")
          );
          // Close the modal after successful import
          props.showModal(false);
        } else if (props.onFileSelect) {
          props.onFileSelect(item, parsedData);
        } else {
          console.log("Parsed persona data:", parsedData);
          // Default behavior: open in new tab if no handlers provided
          window.open(item.html_url, "_blank");
        }
      } catch (error) {
        console.error("Import error:", error);
        // You can add toast notification here if available
        if (props.onError) {
          props.onError(error.message || "Failed to import persona");
        }
      } finally {
        setLoading(false);
      }
    }
  };

  const handleBackClick = () => {
    if (pathHistory.length > 0) {
      const previousPath = pathHistory[pathHistory.length - 1];
      setPathHistory(pathHistory.slice(0, -1));
      setCurrentPath(previousPath);
    }
  };

  const getFileIcon = (name, type) => {
    if (type === "dir") {
      return <span className="text-blue-500 text-xl">📁</span>;
    }

    // Since we only show JSON files now
    return <span className="text-green-600 text-xl">⚙️</span>;
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const breadcrumbs = currentPath ? currentPath.split("/") : [];

  return (
    <ContainerModal showModal={props.showModal} isSettingsModel={true}>
      <div className="select-none border dark:border-border_dark rounded-2xl bg-white dark:bg-black w-full max-w-4xl">
        {/* Modal Header */}
        <div className="flex justify-between items-center px-4 pt-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚙️</span>
            <div>
              <p className="text-xl text-tertiary font-medium">
                <Trans i18nKey="description.persona.selectPersona" />
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                <Trans i18nKey="description.persona.browsePersonas" />
              </p>
            </div>
          </div>
          <img
            src={cross}
            alt="cross"
            className="h-[30px] w-[30px] cursor-pointer p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            onClick={() => props.showModal(false)}
          />
        </div>

        {/* Navigation Bar */}
        {(pathHistory.length > 0 || currentPath) && (
          <div className="px-4 py-3 border-b dark:border-border_dark">
            <div className="flex items-center gap-2">
              {pathHistory.length > 0 && (
                <button
                  onClick={handleBackClick}
                  className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors text-gray-700 dark:text-white"
                >
                  <span>←</span>
                  <Trans i18nKey="description.persona.back" />
                </button>
              )}

              <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">
                  <Trans i18nKey="description.persona.personas" />
                </span>
                {breadcrumbs.map((part, index) => (
                  <React.Fragment key={index}>
                    <span className="mx-1">/</span>
                    <span className="font-medium">{part}</span>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="min-h-96 max-h-96 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          )}

          {error && (
            <div className="p-4 text-center">
              <div className="text-red-500 mb-2 dark:text-red-400">
                <Trans i18nKey="description.persona.errorLoading" />
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {error}
              </div>
              <button
                onClick={() => fetchContents(currentPath)}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors"
              >
                <Trans i18nKey="description.persona.retry" />
              </button>
            </div>
          )}

          {!loading && !error && contents.length === 0 && (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
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
                      <div className="font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {item.type === "file"
                          ? item.name.replace(".json", "") // Remove .json extension for display
                          : item.name}
                      </div>
                      {item.type === "file" && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          <Trans i18nKey="description.persona.configuration" />{" "}
                          • {formatFileSize(item.size)}
                        </div>
                      )}
                      {item.type === "dir" && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          <Trans i18nKey="description.persona.folder" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* {item.type === "dir" && (
                    <span className="text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300">
                      →
                    </span>
                  )} */}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t dark:border-border_dark text-sm text-gray-600 dark:text-gray-400">
          <div className="flex justify-center">
            <button
              onClick={() =>
                window.open(
                  `https://github.com/${REPO_OWNER}/${REPO_NAME}`,
                  "_blank"
                )
              }
              className="px-4 py-2 bg-tertiary hover:bg-blue-600 text-white rounded-lg transition-colors text-sm"
            >
              <Trans i18nKey="description.persona.createOwn" />
            </button>
          </div>
        </div>
      </div>
    </ContainerModal>
  );
}

export default GitHubRepoModal;
