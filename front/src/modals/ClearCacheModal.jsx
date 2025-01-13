// Importing necessary modules
import { Trans } from "react-i18next"; // For translation
import ContainerModal from "./ContainerModal"; // Importing Model component
import cross from "../assets/cross.svg"; // Close icon

function ClearCacheModal(props) {
  return (
    // Model component with export type selection form
    <ContainerModal showModal={props.showModal}>
      <div className="select-none border dark:border-border_dark rounded-2xl bg-white dark:bg-black w-full">
        {/* Modal Header */}
        <div className="flex justify-between items-center px-4 pt-4">
          <p className="text-xl text-tertiary">
            {/* Translation for help title */}
            <Trans i18nKey="description.help_title1"></Trans>:
          </p>
          {/* Close button */}
          <img
            src={cross}
            alt="cross"
            className="h-[30px] w-[30px] cursor-pointer"
            onClick={() => props.showModal(false)} // Click handler to close model
          />
        </div>
        <div className="flex flex-col gap-2 p-4">
          <div className="pt-0 pb-2">
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
              className="text-white p-3 bg-tertiary dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none "
              onClick={() => props.showModal(false)} // Click handler to close model
            >
              <Trans i18nKey="description.cache2"></Trans>
            </button>{" "}
            {/* Clear cache button */}
            <button
              className="text-white p-3 bg-red-600 dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none "
              onClick={() => props.clearCache()}
            >
              <Trans i18nKey="description.cache3"></Trans>
            </button>
          </div>
        </div>
      </div>
    </ContainerModal>
  );
}

export default ClearCacheModal;
