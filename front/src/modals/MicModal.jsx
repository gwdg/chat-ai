// Importing necessary modules
import { Trans } from "react-i18next"; // For translation
import ContainerModal from "./ContainerModal"; // Importing Model component
import cross from "../assets/cross.svg"; // Close icon

// Mic model component
function MicModal(props) {
  return (
    // Model component with mic permission message
    <ContainerModal showModal={props.showModal}>
      <div className="border dark:border-border_dark rounded-2xl bg-white dark:bg-black md:min-w-[350px] h-fit md:max-w-[350px]">
        {/* Modal Header */}
        <div className="flex justify-between items-center px-4 pt-4">
          <p className="text-sm text-tertiary">
            {/* Translation for mic permission message */}
            <Trans i18nKey="description.mic2"></Trans>
          </p>
          {/* Close button */}
          <img
            src={cross}
            alt="cross"
            className="h-[24px] w-[24px] cursor-pointer"
            onClick={() => props.showModal(false)} // Click handler to close model
          />
        </div>
        {/* Mic permission message */}
        <div className="p-4 pt-0">
          <p className="dark:text-white text-black text-justify text-sm">
            {/* Translation for mic permission message */}
            <Trans i18nKey="description.mic1"></Trans>
          </p>
        </div>
      </div>
    </ContainerModal>

  );
}

export default MicModal;
