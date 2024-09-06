// Importing necessary modules
import { Trans } from "react-i18next"; // For translation
import Modal from "./Modal"; // Importing Modal component
import cross from "../assets/cross.svg"; // Close icon
import { Link } from "react-router-dom";

// Help model component
function Help_Model(props) {
  return (
    // Modal component with help content
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
        {/* Help content */}
        <div className="p-4 pt-0">
          <p className="dark:text-white text-black text-justify">
            {/* Translation for help note */}
            <Trans i18nKey="description.help_note"></Trans>{" "}
            {/* Move the link inside the paragraph */}
            <Link
              to={"https://docs.hpc.gwdg.de/services/chat-ai/index.html"}
              target="_blank"
              className="text-tertiary underline"
            >
              Link
            </Link>
          </p>
        </div>
      </div>
    </Modal>
  );
}

export default Help_Model;
