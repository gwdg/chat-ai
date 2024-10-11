// Importing necessary modules
import { Trans } from "react-i18next"; // For translation
import Modal from "./Modal"; // Importing Modal component
import cross from "../assets/cross.svg"; // Close icon
import json_icon from "../assets/json_icon.svg";
import pdf_icon from "../assets/pdf_icon.svg";
import txt_icon from "../assets/txt_icon.svg";
import { useState } from "react"; // For managing component state
import { useDispatch, useSelector } from "react-redux";
import { setExportSettings } from "../Redux/reducers/fileIncludeSettings";
import { setExportImage } from "../Redux/reducers/imageIncludeReducer";

// Export type modal component
function ExportTypeModel(props) {
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
    props.showModal(false); // Close the modal
  }

  // Array of export options
  const exportOptions = [
    { id: "json", icon: json_icon, label: "description.fileFormat1" },
    { id: "pdf", icon: pdf_icon, label: "description.fileFormat2" },
    { id: "text", icon: txt_icon, label: "description.fileFormat3" },
  ];

  const dispatch = useDispatch();
  const exportSettings = useSelector(
    (state) => state.exportSettings.exportSettings
  );

  const exportImage = useSelector((state) => state.exportImage.exportImage);

  // Handler for checkbox state change
  const handleCheckboxChange = (event) => {
    dispatch(setExportSettings(event.target.checked));
  };

  const handleCheckboxChangeImages = (event) => {
    dispatch(setExportImage(event.target.checked));
  };

  return (
    <Modal showModal={props.showModal}>
      <div className="select-none border dark:border-border_dark rounded-2xl bg-white dark:bg-black md:min-w-[700px] h-fit md:max-w-[350px]">
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
          {/* Add the checkbox */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="exportSettings"
              checked={exportSettings}
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
              checked={exportImage}
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
    </Modal>
  );
}

export default ExportTypeModel;
