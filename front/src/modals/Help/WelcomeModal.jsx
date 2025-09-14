import { useCallback, useEffect, useRef, useState } from "react";
import { Trans } from "react-i18next";
import BaseModal from "../BaseModal";

export default function WelcomeModal({ isOpen, onClose, onRunTour }) {

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} minimal={true}>
        <div className="flex flex-col gap-4">
            <div className="pt-0 pb-2">
            <p className="dark:text-white text-black text-justify justify-center text-2xl">
                <Trans i18nKey="tour.welcome_message" /> v0.9
            </p>
            </div>
        <p className="dark:text-white text-black text-sm">
            <Trans i18nKey="tour.description" />
        </p>
        {/* Begin Tour Button */}
        <div className="flex flex-col md:flex-row gap-2 justify-center w-full">
            <button
                onClick={() => { onRunTour(); onClose(); }}
                className="
                    bg-green-500 hover:bg-green-600
                    text-white font-semibold
                    px-6 py-3
                    rounded-xl
                    shadow-lg hover:shadow-xl
                    transition-all duration-200 ease-in-out
                    border border-green-700 dark:border-green-400
                    w-full md:w-auto min-w-[150px]
                    select-none cursor-pointer
                "
            >
                <Trans i18nKey="tour.start_tour" />
            </button>
            {/* Skip Tour Button */}
            <button
                className="text-tertiary dark:text-primary p-3 justify-center items-center md:w-fit w-full min-w-[150px] select-none cursor-pointer"
                onClick={onClose}
            >
                <Trans i18nKey="tour.skip_tour" />
            </button>
            </div>
        </div>
    </BaseModal>
  );
}