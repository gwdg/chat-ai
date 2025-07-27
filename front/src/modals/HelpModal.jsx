// Importing necessary modules
import { Trans } from "react-i18next"; // For translation
import ContainerModal from "./ContainerModal"; // Importing Model component
import cross from "../assets/cross.svg"; // Close icon
import { Link } from "react-router-dom";

// Help model component
function HelpModal(props) {
  return (
    // Model component with help content
    <ContainerModal showModal={props.showModal}>
      <div className="select-none border dark:border-border_dark rounded-2xl bg-white dark:bg-black w-full">
        {/* Modal Header */}
        <div className="flex justify-between items-center px-4 pt-4">
          <p className="text-sm text-tertiary">
            {/* Translation for help title */}
            <Trans i18nKey="description.help_title"></Trans>:
          </p>
          {/* Close button */}
          <img
            src={cross}
            alt="cross"
            className="h-[24px] w-[24px] cursor-pointer p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            onClick={() => props.showModal(false)} // Click handler to close model
          />
        </div>
        {/* Help content */}
        <div className="p-4 pt-0">
          <p className="dark:text-white text-black text-justify text-sm">
            {/* Translation for help note */}
            <Trans i18nKey="description.help_note"></Trans>{" "}
            {/* Move the link inside the paragraph */}
            <Link
              to={"https://docs.hpc.gwdg.de/services/chat-ai/index.html"}
              target="_blank"
              className="text-tertiary underline text-sm"
            >
              Link
            </Link>
          </p>
        </div>
      </div>
    </ContainerModal>
  );
}

export default HelpModal;
