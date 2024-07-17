import React, { useState, useRef } from "react";
import Table from "./Table";

const FilesTable = (props) => {
  const [files, setFiles] = useState([]);
  const fileInputRef = useRef(null);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];

    if (file && file.type !== "application/pdf") {
      console.error("Only PDF files are allowed");
      return;
    }

    if (file) {
      const fileExists = files.some((f) => f.name === file.name);
      if (fileExists) {
        console.error("This file has already been uploaded.");
        return;
      }

      const newFile = {
        index: files.length + 1,
        name: file.name,
        uploadDate: new Date().toLocaleString(),
      };
      setFiles([...files, newFile]);
      event.target.value = ""; // Reset the file input
    }
  };

  const handleDeleteFile = (index) => {
    const updatedFiles = files.filter((file, i) => i !== index);
    const resetFiles = updatedFiles.map((file, i) => ({
      ...file,
      index: i + 1, // Reset index
    }));
    setFiles(resetFiles);
  };

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
        className="text-white p-3 bg-tertiary dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px]"
        type="button"
        onClick={triggerFileInput}
      >
        Upload file
      </button>

      {files.length > 0 ? (
        <Table
          data={files}
          handleDeleteFile={handleDeleteFile}
          isEditing={props.isEditing}
        />
      ) : (
        <p className="dark:text-white text-black">No files uploaded yet.</p>
      )}
    </div>
  );
};

export default FilesTable;
