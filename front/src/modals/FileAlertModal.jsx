/* eslint-disable no-unused-vars */
import { Trans } from "react-i18next";
import ContainerModal from "./ContainerModal";
import cross from "../assets/cross.svg";

function FileAlertModal(props) {
  const handleRefresh = () => {
    props.intentionalRefresh.current = true;
    window.location.reload();
  };
  const handleClose = () => {
    props.showModal(false);
  };

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
            onClick={handleClose}
          />
        </div>
        <div className="flex flex-col gap-2 p-4">
          <div className="pt-0 pb-2">
            <p className="dark:text-white text-black text-justify text-sm">
              <Trans i18nKey="description.fileAlert"></Trans>
            </p>
          </div>
          <div className="flex flex-col md:flex-row gap-2 justify-center w-full">
            <button
              className="text-white p-3 bg-tertiary dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none"
              onClick={handleRefresh}
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
    </ContainerModal>
  );
}

export default FileAlertModal;
