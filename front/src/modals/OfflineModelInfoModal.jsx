/* eslint-disable no-unused-vars */
// Importing necessary modules
import { Trans } from "react-i18next"; // For translation
import ContainerModal from "./ContainerModal"; // Importing Model component
import cross from "../assets/cross.svg"; // Close icon
import { checkModelAvailability } from "../apis/checkModelAvailabilityApi";

function OfflineModelInfoModal(props) {
  async function getRes() {
    // Close modal first
    props?.showModal(false);

    // Then make the request
    try {
      const response = await checkModelAvailability(props?.model);
    } catch (error) {
      console.error("An error occurred", error);
    }
  }

  return (
    <ContainerModal showModal={props.showModal}>
      <div className="select-none border dark:border-border_dark rounded-2xl bg-white dark:bg-black w-full">
        <div className="flex justify-between items-center px-4 pt-4">
          <p className="text-sm text-tertiary">
            <Trans i18nKey="description.help_title"></Trans>:
          </p>
          <img
            src={cross}
            alt="cross"
            className="h-[24px] w-[24px] cursor-pointer"
            onClick={() => props.showModal(false)}
          />
        </div>
        <div className="flex flex-col gap-2 p-4">
          <div className="pt-0 pb-2">
            <p className="dark:text-white text-black text-justify text-sm">
              <Trans i18nKey="description.offline"></Trans>
            </p>
          </div>
          <div className="flex flex-col md:flex-row gap-2 justify-center w-full">
            <button
              className="text-white p-3 bg-tertiary dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none "
              onClick={() => getRes()}
            >
              Ok
            </button>
          </div>
        </div>
      </div>
    </ContainerModal>
  );
}

export default OfflineModelInfoModal;
