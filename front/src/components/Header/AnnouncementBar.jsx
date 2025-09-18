import { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Trans } from "react-i18next";
import { X } from "lucide-react";
import { closeAnnouncement, selectCountAnnouncement } from "../../Redux/reducers/interfaceSettingsSlice";

export default function AnnouncementBar() {
  const dispatch = useDispatch();
  const closeCount = useSelector(selectCountAnnouncement);
  const [showAnnouncement, setShowAnnouncement] = useState(true);
  const announcement = import.meta.env.VITE_ANNOUNCEMENT;
  if (!announcement || announcement === "") return;

  useEffect(() => {
    setShowAnnouncement(closeCount < 5);
  }, []);

  const handleClose = () => {
    // Hide immediately
    setShowAnnouncement(false);
    // Update Redux to persist close count
    dispatch(closeAnnouncement());
  };

  return showAnnouncement ? (
    <div className="bg-orange-500 text-white select-none">
      <div className="px-2 sm:px-4 flex items-center justify-between">
        <p className="text-xs sm:text-sm md:text-base font-medium py-1.5 sm:py-2 leading-tight sm:leading-normal">
          {`${announcement}`}
        </p>
        <button
          onClick={handleClose}
          className="p-0.5 sm:p-1 hover:bg-orange-600 rounded-full transition-colors flex-shrink-0 ml-2 cursor-pointer"
          aria-label="Close announcement"
        >
          <X
            className="h-[20px] w-[20px] sm:h-[24px] sm:w-[24px] md:h-[30px] md:w-[30px] cursor-pointer text-[#009EE0]"
            alt="cross"
          />
        </button>
      </div>
    </div>
  ) : (
    <></>
  );
}
