//filesTable.jsx
import React, { useRef } from "react";
import { Trans } from "react-i18next";
import Table from "./Table";

const FilesTable = ({ files, onUpload, onDelete, isEditing }) => {
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
        name: file.name,
        uploadDate: new Date().toLocaleString(),
      };

      onUpload(newFile);
      event.target.value = "";
    }
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
        <Trans i18nKey="description.arcana_file_upload"></Trans>
      </button>

      {files && files.length > 0 ? (
        <Table data={files} handleDeleteFile={onDelete} isEditing={isEditing} />
      ) : (
        <p className="dark:text-white text-black">
          <Trans i18nKey="description.arcana_file"></Trans>
        </p>
      )}
    </div>
  );
};

export default FilesTable;