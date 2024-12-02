// FilesTable.jsx
import { useEffect, useRef, useState } from "react";
import Table from "./Table";
import { Trans } from "react-i18next";
import { uploadFile, deleteFile } from "../../apis/ArcanaApis";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { useSelector } from "react-redux";
import { useToast } from "../../hooks/useToast";

const FilesTable = ({ folderName, filesFromAPI }) => {
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true); // State to manage loading state
  const fileInputRef = useRef(null);
  const isDarkMode = useSelector((state) => state.theme.isDarkMode);
  const { notifySuccess, notifyError } = useToast();

  // // Displays an error notification
  // const notifyError = (message) => {
  //   toast.error(message, {
  //     className: toastClass,
  //     autoClose: 1000,
  //     onClose: () => {},
  //   });
  // };

  // // Displays a success notification
  // const notifySuccess = (message) =>
  //   toast.success(message, {
  //     className: toastClass,
  //     autoClose: 1000,
  //     onClose: () => {},
  //   });

  // Initialize the files state with files from the API response
  useEffect(() => {
    setIsLoading(true); // Start loading as soon as the component mounts

    if (filesFromAPI) {
      const formattedFiles = filesFromAPI.map((file, index) => ({
        id: file.id,
        name: file.name,
        uploadDate: new Date(file.created_at).toLocaleString(),
        url: file.url,
        index: index + 1, // Set index starting from 1
      }));

      // Simulate a slight delay to ensure skeleton visibility
      setTimeout(() => {
        setFiles(formattedFiles);
        setIsLoading(false); // Stop loading once files are set
      }, 500); // Adjust delay as needed (500ms here to simulate loading)
    } else {
      setIsLoading(false); // Stop loading if there's no data
    }
  }, [filesFromAPI]);

  // Handle file upload
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];

    if (!file) return;

    if (file.type !== "application/pdf") {
      notifyError("Only PDF files are allowed.");
      return;
    }

    const fileExists = files.some((f) => f.name === file.name);
    if (fileExists) {
      notifyError("This file has already been uploaded.");
      return;
    }

    try {
      const response = await uploadFile(file, folderName, file.name);
      const newFile = {
        id: response.id,
        name: response.name,
        uploadDate: new Date(response.created_at).toLocaleString(),
        url: response.url,
        index: files.length + 1,
      };

      setFiles((prevFiles) => [...prevFiles, newFile]);
      notifySuccess("File uploaded successfully.");

      event.target.value = ""; // Reset the file input
    } catch (error) {
      console.error("Error uploading file:", error);
      notifyError("Error uploading file.");
    }
  };

  // Handle file deletion
  const handleDeleteFile = async (index) => {
    const fileToDelete = files[index];
    try {
      const success = await deleteFile(folderName, fileToDelete.name);
      if (success) {
        setFiles((prevFiles) =>
          prevFiles
            .filter((_, i) => i !== index)
            .map((file, i) => ({
              ...file,
              index: i + 1, // Reset index
            }))
        );
        notifySuccess("File deleted successfully.");
      } else {
        notifyError("Failed to delete file.");
      }
    } catch (error) {
      console.error("Error deleting file:", error);
      notifyError("Failed to delete file.");
    }
  };

  // Trigger file input click
  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  return (
    <div className="flex flex-col gap-4">
      <input
        type="file"
        accept="application/pdf"
        onChange={handleFileUpload}
        className="hidden"
        ref={fileInputRef}
      />
      <button
        className="text-white p-3 bg-tertiary dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none"
        type="button"
        onClick={triggerFileInput}
      >
        <Trans i18nKey="description.arcana_file_upload"></Trans>
      </button>

      {isLoading ? (
        // Skeleton loader for table while loading
        <div>
          <Skeleton
            height={20}
            count={3}
            baseColor={isDarkMode ? "#3a3a3a" : "#e0e0e0"} // Darker gray for dark mode, lighter gray for light mode
            highlightColor={isDarkMode ? "#525252" : "#f0f0f0"} // Slightly lighter gray for highlight
            className="mb-1"
          />
        </div>
      ) : files.length > 0 ? (
        <Table data={files} handleDeleteFile={handleDeleteFile} />
      ) : (
        !isLoading && (
          <p className="dark:text-white text-black">
            <Trans i18nKey="description.arcana_file"></Trans>
          </p>
        )
      )}
    </div>
  );
};

export default FilesTable;
