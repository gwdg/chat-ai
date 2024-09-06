// Importing necessary modules
import { Trans } from "react-i18next"; // For translation
import Modal from "./Modal"; // Importing Modal component
import cross from "../assets/cross.svg"; // Close icon
import { useState } from "react"; // For managing component state

// Export type modal component
function ExportTypeModel(props) {
  const [value, setValue] = useState("json"); // State for selected export type

  // Function to handle change in export type selection
  const handleChange = (event) => {
    setValue(event.target.value); // Update selected export type
  };

  // Function to handle export file action
  function exportFile() {
    props.exportFile(value, props.conversation); // Pass the conversation data
    props.showModal(false); // Close the modal
  }

  return (
    <Modal showModal={props.showModal}>
      <div className="select-none border dark:border-border_dark rounded-2xl bg-white dark:bg-black md:min-w-[700px] h-fit md:max-w-[350px]">
        <div className="flex justify-between items-center px-4 pt-4">
          <p className="text-xl text-tertiary">
            <Trans i18nKey="description.help_title"></Trans> :
          </p>
          <img
            src={cross}
            alt="cross"
            className="h-[30px] w-[30px] cursor-pointer"
            onClick={() => props.showModal(false)}
          />
        </div>
        <form>
          <div className="flex flex-col gap-2 p-4">
            <div className="flex gap-2">
              <input
                type="radio"
                id="json"
                name="format"
                value="json"
                checked={value === "json"}
                onChange={handleChange}
              />
              <label className="dark:text-white text-black" htmlFor="json">
                <Trans i18nKey="description.fileFormat1"></Trans>
              </label>
            </div>
            <div className="flex gap-2">
              <input
                type="radio"
                id="pdf"
                name="format"
                value="pdf"
                checked={value === "pdf"}
                onChange={handleChange}
              />
              <label className="dark:text-white text-black" htmlFor="pdf">
                <Trans i18nKey="description.fileFormat2"></Trans>
              </label>
            </div>
            {/* Add a new radio button for text file */}
            <div className="flex gap-2">
              <input
                type="radio"
                id="text"
                name="format"
                value="text"
                checked={value === "text"}
                onChange={handleChange}
              />
              <label className="dark:text-white text-black" htmlFor="text">
                Export as Text
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
        </form>
      </div>
    </Modal>
  );
}

export default ExportTypeModel;
