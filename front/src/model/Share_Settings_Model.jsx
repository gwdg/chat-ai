// Importing necessary modules
import { Trans } from "react-i18next"; // For translation
import Modal from "./Modal"; // Importing Modal component
import cross from "../assets/cross.svg"; // Close icon

function Share_Settings_Model(props) {
  // Handler for checkbox state change
  const handleCheckboxChange = (event) => {
    props.setLocalState((prevState) => ({
      ...prevState,
      dontShow: {
        ...prevState.exportOptions,
        dontShowAgainShare: event.target.checked,
      },
    }));
  };

  const handleCheckboxChangeArcana = (event) => {
    props.setLocalState((prevState) => ({
      ...prevState,
      exportOptions: {
        ...prevState.exportOptions,
        exportArcana: event.target.checked,
      },
    }));
  };

  return (
    <Modal showModal={props.showModal}>
      <div className="select-none border dark:border-border_dark rounded-2xl bg-white dark:bg-black md:min-w-[700px] h-fit md:max-w-[350px]">
        {/* Modal header */}
        <div className="flex justify-between items-center px-4 pt-4">
          <p className="text-xl text-tertiary">
            <Trans i18nKey="description.help_title"></Trans>:
          </p>
          {/* Close button */}
          <img
            src={cross}
            alt="cross"
            className="h-[30px] w-[30px] cursor-pointer"
            onClick={() => props.showModal(false)}
          />
        </div>
        <div className="flex flex-col gap-2 p-4">
          <div className="pt-0 pb-2">
            <p className="dark:text-white text-black text-justify">
              <Trans i18nKey="description.exportSettings1"></Trans>
            </p>
          </div>

          {props.arcana.id && props.arcana.key ? (
            <>
              <div className="">
                <p className="text-red-600">
                  <Trans i18nKey="description.arcana_warn"></Trans>
                </p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="exportArcana"
                  checked={props.exportArcana}
                  onChange={handleCheckboxChangeArcana}
                  className={`h-5 w-5 rounded-md border-gray-300 text-tertiary focus:ring-tertiary cursor-pointer transition duration-200 ease-in-out ${
                    !props.arcana.id && !props.arcana.key
                      ? "bg-gray-400 cursor-not-allowed"
                      : ""
                  }`}
                  disabled={!props.arcana.id && !props.arcana.key}
                />
                <label
                  htmlFor="exportArcana"
                  className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none"
                >
                  <Trans i18nKey="description.exportArcana"></Trans>
                </label>
              </div>
            </>
          ) : null}

          {/* Add the checkbox */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="dontShowAgain"
              checked={props.dontShowAgain}
              onChange={handleCheckboxChange}
              className="h-5 w-5 rounded-md border-gray-300 text-tertiary focus:ring-tertiary cursor-pointer transition duration-200 ease-in-out"
            />
            <label
              htmlFor="dontShowAgain"
              className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none"
            >
              <Trans i18nKey="description.dont_show_again"></Trans>
            </label>
          </div>

          {/* Buttons */}
          <div className="flex flex-col md:flex-row gap-2 justify-end w-full">
            {/* Close button */}
            {/* <button
              className="text-white p-3 bg-tertiary dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none "
              onClick={() => props.showModal(false)}
            >
              <Trans i18nKey="description.cache2"></Trans>
            </button> */}
            {/* Clear cache button */}
            <button
              className="text-white p-3 bg-green-600 dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none "
              onClick={() => props.handleShareSettings()}
            >
              <Trans i18nKey="description.exportSettings2"></Trans>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default Share_Settings_Model;
