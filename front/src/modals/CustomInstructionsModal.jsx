// Importing necessary modules
import { Trans } from "react-i18next"; // For translation
import ContainerModal from "./ContainerModal"; // Importing Model component
import cross from "../assets/cross.svg"; // Close icon

// Custom instructions model component
function CustomInstructionsModal(props) {
  return (
    // Model component with custom instructions content
    <ContainerModal showModal={props.showModal}>
      <div className="select-none border dark:border-border_dark rounded-2xl bg-white dark:bg-black w-full">
        {/* Modal Header */}
        <div className="flex justify-between items-center px-4 pt-4">
          <p className="text-xl text-tertiary">
            {/* Translation for help title */}
            <Trans i18nKey="description.help_title"></Trans>:
          </p>
          {/* Close button */}
          <img
            src={cross}
            alt="cross"
            className="h-[30px] w-[30px] cursor-pointer"
            onClick={() => props.showModal(false)} // Click handler to close model
          />
        </div>
        {/* Model body */}
        <div className="p-4 pt-0">
          <p className="dark:text-white text-black text-justify">
            {/* Translation for custom instructions */}
            <Trans i18nKey="description.custom"></Trans>
          </p>
        </div>
      </div>
    </ContainerModal>

  );
}

export default CustomInstructionsModal;
