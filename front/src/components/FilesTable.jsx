// FilesTable.jsx
import { useEffect, useRef, useState } from "react";
import Table from "./Table";
import { Trans } from "react-i18next";
import { uploadFile, deleteFile } from "../apis/ArcanaApis";

const FilesTable = ({ folderName, filesFromAPI }) => {
  const [files, setFiles] = useState([]);
  const fileInputRef = useRef(null);

  // Initialize the files state with files from the API response
  useEffect(() => {
    if (filesFromAPI) {
      const formattedFiles = filesFromAPI.map((file, index) => ({
        id: file.id,
        name: file.name,
        uploadDate: new Date(file.created_at).toLocaleString(),
        url: file.url,
        index: index + 1, // Set index starting from 1
      }));
      setFiles(formattedFiles);
    }
  }, [filesFromAPI]);

  // Handle file upload
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];

    if (!file) return;

    if (file.type !== "application/pdf") {
      console.error("Only PDF files are allowed");
      return;
    }

    const fileExists = files.some((f) => f.name === file.name);
    if (fileExists) {
      console.error("This file has already been uploaded.");
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
      event.target.value = ""; // Reset the file input
    } catch (error) {
      console.error("Error uploading file:", error);
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
      }
    } catch (error) {
      console.error("Error deleting file:", error);
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

      {files.length > 0 ? (
        <Table data={files} handleDeleteFile={handleDeleteFile} />
      ) : (
        <p className="dark:text-white text-black">
          <Trans i18nKey="description.arcana_file"></Trans>
        </p>
      )}
    </div>
  );
};

export default FilesTable;
