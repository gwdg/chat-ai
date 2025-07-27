// Importing necessary modules
import { Trans } from "react-i18next"; // For translation
import ContainerModal from "./ContainerModal"; // Importing Model component

function SessionExpiredModal(props) {
  return (
    <ContainerModal showModal={props.showModal} isForceAction={true}>
      <div className="select-none border dark:border-border_dark rounded-2xl bg-white dark:bg-black w-full">
        {/* Modal Header */}
        <div className="flex justify-between items-center px-4 pt-4">
          <p className="text-sm text-tertiary">
            <Trans i18nKey="description.help_title"></Trans>:
          </p>
          {/* Remove the close button completely or make it hidden */}
          {/* No close button here */}
        </div>
        <div className="flex flex-col gap-2 p-4">
          <div className="pt-0 pb-2">
            <p className="dark:text-white text-black text-justify text-sm">
              <Trans i18nKey="description.session1"></Trans>
            </p>
          </div>
          <div className="flex flex-col md:flex-row gap-2 justify-center w-full">
            <button
              className="text-white p-3 bg-tertiary dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none"
              onClick={() => location.reload()}
            >
              <Trans i18nKey="description.session3"></Trans>
            </button>
          </div>
        </div>
      </div>
    </ContainerModal>
  );
}

export default SessionExpiredModal;
