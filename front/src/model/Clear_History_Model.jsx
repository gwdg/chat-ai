// Importing necessary modules
import { Trans } from "react-i18next"; // For translation
import Modal from "./Modal"; // Importing Modal component
import cross from "../assets/cross.svg"; // Close icon
import { useSelector, useDispatch } from "react-redux"; // For accessing and dispatching Redux state
import { setDontShowAgain } from "../Redux/reducers/showAgainReducer";

function Clear_History_Model(props) {
  const dispatch = useDispatch();
  const dontShowAgain = useSelector((state) => state.showAgain.dontShowAgain); // Get the checkbox state from Redux

  // Handler for checkbox state change
  const handleCheckboxChange = (event) => {
    dispatch(setDontShowAgain(event.target.checked));
  };

  return (
    <Modal showModal={props.showModal}>
      <div className="select-none border dark:border-border_dark rounded-2xl bg-white dark:bg-black md:min-w-[700px] h-fit md:max-w-[350px]">
        {/* Modal header */}
        <div className="flex justify-between items-center px-4 pt-4">
          <p className="text-xl text-tertiary">
            <Trans i18nKey="description.help_title1"></Trans>:
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
              <Trans i18nKey="description.history"></Trans>
            </p>
          </div>

          {/* Add the checkbox */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="dontShowAgain"
              checked={dontShowAgain}
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
          <div className="flex flex-col md:flex-row gap-2 justify-between w-full">
            {/* Close button */}
            <button
              className="text-white p-3 bg-tertiary dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none "
              onClick={() => props.showModal(false)}
            >
              <Trans i18nKey="description.cache2"></Trans>
            </button>
            {/* Clear cache button */}
            <button
              className="text-white p-3 bg-red-600 dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none "
              onClick={() => props.clearHistory()}
            >
              <Trans i18nKey="description.cache3"></Trans>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default Clear_History_Model;
