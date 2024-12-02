// Importing necessary modules
import { Trans } from "react-i18next"; // For translation
import Model from "./Model"; // Importing Model component
import cross from "../assets/cross.svg"; // Close icon
import { offlineModelCall } from "../apis/OfflineCall";

function Offline_Model_Model(props) {
  async function getRes() {
    try {
      const response = await offlineModelCall(props?.model);
    } catch (error) {
      console.error("An error occurred", error);
    }
    props?.showModel(false);
  }

  return (
    <Model showModel={props.showModel}>
      <div className="select-none border dark:border-border_dark rounded-2xl bg-white dark:bg-black md:min-w-[700px] h-fit md:max-w-[350px]">
        <div className="flex justify-between items-center px-4 pt-4">
          <p className="text-xl text-tertiary">
            <Trans i18nKey="description.help_title"></Trans>:
          </p>
          <img
            src={cross}
            alt="cross"
            className="h-[30px] w-[30px] cursor-pointer"
            onClick={() => props.showModel(false)}
          />
        </div>
        <div className="flex flex-col gap-2 p-4">
          <div className="pt-0 pb-2">
            <p className="dark:text-white text-black text-justify">
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
    </Model>
  );
}

export default Offline_Model_Model;
