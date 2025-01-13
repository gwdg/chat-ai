/* eslint-disable no-unused-vars */
// Importing necessary modules
import { Trans } from "react-i18next"; // For translation
import ContainerModal from "./ContainerModal"; // Importing Model component
import cross from "../assets/cross.svg"; // Close icon
import json_icon from "../assets/json_icon.svg";
import pdf_icon from "../assets/pdf_icon.svg";
import txt_icon from "../assets/txt_icon.svg";
import { useState } from "react"; // For managing component state

// Export type model component
function ExportTypeModal(props) {
  const [value, setValue] = useState("json");
  const [containsImage, setContainsImage] = useState(
    props.conversation.some((message) => {
      return (
        message.role === "user" &&
        Array.isArray(message.content) &&
        message.content.some((item) => item.type === "image_url")
      );
    })
  );

  // Function to handle change in export type selection
  const handleChange = (format) => {
    setValue(format); // Update selected export type
  };

  // Function to handle export file action
  function exportFile() {
    props.exportFile(value, props.conversation); // Pass the conversation data
    props.showModal(false); // Close the model
  }

  // Array of export options
  const exportOptions = [
    { id: "json", icon: json_icon, label: "description.fileFormat1" },
    { id: "pdf", icon: pdf_icon, label: "description.fileFormat2" },
    { id: "text", icon: txt_icon, label: "description.fileFormat3" },
  ];

  // Handler for checkbox state change
  const handleCheckboxChange = (event) => {
    props.setLocalState((prevState) => ({
      ...prevState,
      exportOptions: {
        ...prevState.exportOptions,
        exportSettings: event.target.checked,
      },
    }));
  };

  const handleCheckboxChangeImages = (event) => {
    props.setLocalState((prevState) => ({
      ...prevState,
      exportOptions: {
        ...prevState.exportOptions,
        exportImage: event.target.checked,
      },
    }));
  };

  const handleCheckboxChangeArcana = (event) => {
    props.setLocalState((prevState) => ({
      ...prevState,
      exportOptions: {
        ...prevState.exportOptions,
        exportArcana: event.target.checked,
      },
    }));
  };

  return (
    <ContainerModal showModal={props.showModal}>
      <div className="select-none border dark:border-border_dark rounded-2xl bg-white dark:bg-black w-full">
        <div className="flex justify-between items-center px-4 pt-4">
          <p className="text-xl text-tertiary">
            <Trans i18nKey="description.export_title"></Trans>:
          </p>
          <img
            src={cross}
            alt="cross"
            className="h-[30px] w-[30px] cursor-pointer"
            onClick={() => props.showModal(false)}
          />
        </div>
        <div className="flex flex-col gap-4 p-4">
          {exportOptions.map((option) => (
            <div
              key={option.id}
              className={`flex items-center gap-4 p-4 border rounded-lg cursor-pointer transition-all duration-200 ${
                value === option.id
                  ? "border-tertiary bg-gray-100 dark:bg-gray-800"
                  : "border-gray-300 dark:border-gray-600"
              }`}
              onClick={() => handleChange(option.id)}
            >
              <img src={option.icon} alt={option.id} className="h-8 w-8" />
              <label
                className={`text-lg ${
                  value === option.id
                    ? "text-tertiary"
                    : "text-black dark:text-white"
                }`}
              >
                <Trans i18nKey={option.label}></Trans>
              </label>
            </div>
          ))}
          {props.arcana.id && props.arcana.key && props.exportSettings ? (
            <>
              <div className="">
                <p className="text-red-600">
                  <Trans i18nKey="description.arcana_warn"></Trans>
                </p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="exportArcana"
                  checked={props.exportArcana}
                  onChange={handleCheckboxChangeArcana}
                  className={`h-5 w-5 rounded-md border-gray-300 text-tertiary focus:ring-tertiary cursor-pointer transition duration-200 ease-in-out ${
                    !props.arcana.id && !props.arcana.key
                      ? "bg-gray-400 cursor-not-allowed"
                      : ""
                  }`}
                  disabled={!props.arcana.id && !props.arcana.key}
                />
                <label
                  htmlFor="exportArcana"
                  className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none"
                >
                  <Trans i18nKey="description.exportArcana"></Trans>
                </label>
              </div>
            </>
          ) : null}

          {/* Add the checkbox */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="exportSettings"
              checked={props.exportSettings}
              onChange={handleCheckboxChange}
              className="h-5 w-5 rounded-md border-gray-300 text-tertiary focus:ring-tertiary cursor-pointer transition duration-200 ease-in-out"
            />
            <label
              htmlFor="exportSettings"
              className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none"
            >
              <Trans i18nKey="description.exportSettings"></Trans>
            </label>
          </div>
          {/* Add the checkbox */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="exportImage"
              checked={props.exportImage}
              onChange={handleCheckboxChangeImages}
              className={`h-5 w-5 rounded-md border-gray-300 text-tertiary focus:ring-tertiary cursor-pointer transition duration-200 ease-in-out ${
                !containsImage ? "bg-gray-400 cursor-not-allowed" : ""
              }`}
              disabled={!containsImage}
            />
            <label
              htmlFor="exportImage"
              className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none"
            >
              <Trans i18nKey="description.exportImages"></Trans>
            </label>
          </div>

          <div className="flex justify-end w-full">
            <button
              className="text-white p-3 bg-tertiary dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none"
              onClick={exportFile}
              type="button"
            >
              <Trans i18nKey="description.export"></Trans>
            </button>
          </div>
        </div>
      </div>
    </ContainerModal>

  );
}

export default ExportTypeModal;
