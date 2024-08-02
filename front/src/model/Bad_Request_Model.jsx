// Importing necessary modules
import { Trans } from "react-i18next"; // For translation
import Modal from "./Modal"; // Importing Modal component
import cross from "../assets/cross.svg"; // Close icon

function Bad_Request_Model(props) {
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
              <Trans i18nKey="description.bad"></Trans>
            </p>
          </div>{" "}
          {/* Close button */}
          <div className="flex md:justify-end justify-center w-full">
            <button
              className="text-white p-3 bg-tertiary dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none "
              onClick={() => props.showModal(false)} // Click handler to close modal
            >
              <Trans i18nKey="description.session2"></Trans>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default Bad_Request_Model;
