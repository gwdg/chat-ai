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
    props.exportFile(value); // Execute export file function from parent component
    props.showModal(false); // Close the modal
  }

  return (
    // Modal component with export type selection form
    <Modal showModal={props.showModal}>
      <div className="select-none border dark:border-border_dark rounded-2xl bg-white dark:bg-black md:min-w-[700px] h-fit md:max-w-[350px]">
        {/* Modal header */}
        <div className="flex justify-between items-center px-4 pt-4">
          <p className="text-xl text-tertiary">
            {/* Translation for help title */}
            <Trans i18nKey="description.help_title"></Trans> :
          </p>
          {/* Close button */}
          <img
            src={cross}
            alt="cross"
            className="h-[30px] w-[30px] cursor-pointer"
            onClick={() => props.showModal(false)} // Click handler to close modal
          />
        </div>
        {/* Export type selection form */}
        <form>
          <div className="flex flex-col gap-2 p-4">
            {/* Radio button for JSON format */}
            <div className="flex gap-2">
              <input
                type="radio"
                id="json"
                name="format"
                value="json"
                checked={value === "json"} // Check if JSON format is selected
                onChange={handleChange} // Change handler for export type selection
              />
              <label className="dark:text-white text-black" htmlFor="json">
                {/* Translation for JSON format */}
                <Trans i18nKey="description.fileFormat1"></Trans>
              </label>{" "}
            </div>
            {/* Radio button for PDF format */}
            <div className="flex gap-2">
              {" "}
              <input
                type="radio"
                id="pdf"
                name="format"
                value="pdf"
                checked={value === "pdf"} // Check if PDF format is selected
                onChange={handleChange} // Change handler for export type selection
              />
              <label className="dark:text-white text-black" htmlFor="pdf">
                {/* Translation for PDF format */}
                <Trans i18nKey="description.fileFormat2"></Trans>
              </label>
            </div>
            {/* Export button */}
            <div className="flex justify-end w-full">
              <button
                className="text-white p-3 bg-tertiary dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none "
                onClick={exportFile} // Click handler to export file
                type="button"
              >
                {/* Translation for export button */}
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
