import Model from "./Model";
import cross from "../assets/cross.svg";
import { Trans } from "react-i18next";

function ConfirmationPopup({ onClose, onConfirm }) {
  return (
    <Model showModel={onClose}>
      <div className="select-none border dark:border-border_dark rounded-2xl bg-white dark:bg-black md:min-w-[700px] h-fit md:max-w-[350px]">
        <div className="flex justify-between items-center px-4 pt-4">
          <p className="text-xl text-tertiary">
            {" "}
            <Trans i18nKey="description.delete_title"></Trans>
          </p>
          <img
            src={cross}
            alt="close"
            className="h-[30px] w-[30px] cursor-pointer"
            onClick={() => onClose(false)}
          />
        </div>
        <div className="flex flex-col gap-2 p-4">
          <div className="pt-0 pb-2">
            <p className="dark:text-white text-black text-justify">
              {" "}
              <Trans i18nKey="description.delete_message"></Trans>
            </p>
          </div>
          <div className="flex flex-col md:flex-row gap-2 justify-between w-full">
            <button
              className="text-white p-3 bg-red-600 dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none"
              onClick={() => onClose(false)}
            >
              <Trans i18nKey="description.delete_cancelText"></Trans>
            </button>{" "}
            <button
              className="text-white p-3 bg-tertiary dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none"
              onClick={onConfirm}
            >
              <Trans i18nKey="description.delete_confirmText"></Trans>
            </button>
          </div>
        </div>
      </div>
    </Model>
  );
}

export default ConfirmationPopup;
