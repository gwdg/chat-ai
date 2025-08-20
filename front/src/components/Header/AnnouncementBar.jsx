import { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Trans } from "react-i18next";
import { X } from "lucide-react";

export default function AnnouncementBar() {
  // TODO load announcement text from package and only display if exists
  const dispatch = useDispatch();
  const closeCount = useSelector((state) => state.anncCount);
  const [showAnnouncement, setShowAnnouncement] = useState(true);

  useEffect(() => {
    setShowAnnouncement(closeCount < 3);
  }, []);

  const handleClose = () => {
    // Hide immediately
    setShowAnnouncement(false);
    // Update Redux to persist close count
    dispatch({ type: "SET_ANNCCOUNT", payload: closeCount + 1 });
  };

  return showAnnouncement ? (
    <div className="bg-orange-500 text-white select-none">
      <div className="px-2 sm:px-4 flex items-center justify-between">
        <p className="text-xs sm:text-sm md:text-base font-medium py-1.5 sm:py-2 leading-tight sm:leading-normal">
          <Trans i18nKey="description.announcement" />
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
