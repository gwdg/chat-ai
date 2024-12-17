import { Trans } from "react-i18next";
import cross from "../../assets/cross.svg";

const AnnouncementBar = ({ onClose }) => {
  return (
    <div className="bg-orange-500 text-white select-none">
      <div className="px-2 sm:px-4 flex items-center justify-between">
        <p className="text-xs sm:text-sm md:text-base font-medium py-1.5 sm:py-2 leading-tight sm:leading-normal">
          <Trans i18nKey="description.announcement" />
        </p>
        <button
          onClick={onClose}
          className="p-0.5 sm:p-1 hover:bg-orange-600 rounded-full transition-colors flex-shrink-0 ml-2"
          aria-label="Close announcement"
        >
          <img
            src={cross}
            alt="cross"
            className="h-[20px] w-[20px] sm:h-[24px] sm:w-[24px] md:h-[30px] md:w-[30px] cursor-pointer"
          />
        </button>
      </div>
    </div>
  );
};

export default AnnouncementBar;
