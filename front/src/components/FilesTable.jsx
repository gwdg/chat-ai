import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import Table from "./Table";
import { Trans } from "react-i18next";
import { setFiles } from "../Redux/actions/arcanaAction";

const FilesTable = ({ arcanaIndex, isEditing }) => {
  const dispatch = useDispatch();
  const files = useSelector((state) => state.arcana[arcanaIndex]?.files || []);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const arcanaExists = files.length > 0; // Since `files` is fetched correctly, no need to check again
    if (arcanaExists && files.length === 0) {
      dispatch(setFiles({ index: arcanaIndex, files: [] }));
    }
  }, [dispatch, arcanaIndex, files.length]);

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
      const updatedFiles = [...files, newFile];
      dispatch(setFiles({ index: arcanaIndex, files: updatedFiles }));
      event.target.value = ""; // Reset the file input
    }
  };

  const handleDeleteFile = (index) => {
    const updatedFiles = files.filter((file, i) => i !== index);
    const resetFiles = updatedFiles.map((file, i) => ({
      ...file,
      index: i + 1, // Reset index
    }));
    dispatch(setFiles({ index: arcanaIndex, files: resetFiles }));
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

      {files.length > 0 ? (
        <Table
          data={files}
          handleDeleteFile={handleDeleteFile}
          isEditing={isEditing}
        />
      ) : (
        <p className="dark:text-white text-black">
          <Trans i18nKey="description.arcana_file"></Trans>
        </p>
      )}
    </div>
  );
};

export default FilesTable;
