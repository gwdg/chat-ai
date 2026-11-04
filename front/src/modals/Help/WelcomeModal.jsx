import { Trans } from "react-i18next";
import BaseModal from "../BaseModal";

import packageJson from "../../../package.json";
import { useDispatch } from "react-redux";
import {
  closeTour
} from "../../Redux/reducers/interfaceSettingsSlice";

export default function WelcomeModal({ isOpen, onClose, onRunTour }) {
  const dispatch = useDispatch();

  function handleSkipTour() {
    onClose();
    dispatch(closeTour());
  }

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} minimal={true}>
        <div className="flex flex-col gap-4">
            <div className="pt-0 pb-2">
            <p className="text-base-content text-justify justify-center text-2xl">
                <Trans i18nKey="tour.welcome_message" /> {packageJson.version}
            </p>
            </div>
        <p className="text-base-content text-sm">
            <Trans i18nKey="tour.description" />
        </p>
        {/* Begin Tour Button */}
        <div className="flex flex-col md:flex-row gap-2 justify-center w-full">
            <button
                onClick={() => { onRunTour(); onClose(); }}
                className="btn btn-success btn-lg shadow-lg w-full md:w-auto min-w-[150px] select-none"
            >
                <Trans i18nKey="tour.start_tour" />
            </button>
            {/* Skip Tour Button */}
            <button
                className="btn btn-ghost text-accent dark:text-primary md:w-fit w-full min-w-[150px] select-none"
                onClick={handleSkipTour}
            >
                <Trans i18nKey="tour.skip_tour" />
            </button>
            </div>
        </div>
    </BaseModal>
  );
}