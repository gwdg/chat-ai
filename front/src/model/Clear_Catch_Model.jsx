// Importing necessary modules
import { Trans } from "react-i18next"; // For translation
import Modal from "./Modal"; // Importing Modal component
import cross from "../assets/cross.svg"; // Close icon

function Clear_Catch_Model(props) {
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
        <div className="flex flex-col gap-2 p-4">
          <div className="p-4 pt-0">
            <p className="dark:text-white text-black text-justify">
              {/* Translation for mic permission message */}
              <Trans i18nKey="description.cache1"></Trans>
            </p>
          </div>{" "}
          {/* Buttons */}
          <div className="flex flex-col md:flex-row gap-2 justify-between w-full">
            {" "}
            {/* Close button */}
            <button
              className="text-white p-3 bg-tertiary dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px]"
              onClick={() => props.showModal(false)} // Click handler to close modal
            >
              <Trans i18nKey="description.cache2"></Trans>
            </button>{" "}
            {/* Clear cache button */}
            <button
              className="text-white p-3 bg-red-600 dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px]"
              onClick={() => props.clearCatch()}
            >
              <Trans i18nKey="description.cache3"></Trans>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default Clear_Catch_Model;
