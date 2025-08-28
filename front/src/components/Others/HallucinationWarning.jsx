import { Link } from "react-router-dom";
import { Trans } from "react-i18next";
import { useSelector, useDispatch } from "react-redux";
import { useState } from "react";
//Assets
import { X } from "lucide-react";

import {
  selectCountHallucination,
  selectShowSettings,
} from "../../Redux/reducers/interfaceSettingsSlice";
import { closeHallucination } from "../../Redux/reducers/interfaceSettingsSlice";

export default function HallucinationWarning() {
  const dispatch = useDispatch();
  const countHallucination = useSelector(selectCountHallucination);
  const [closedHallucination, setClosedHallucination] = useState(false);

  const handleClose = () => {
    setClosedHallucination(true); // Hide immediately
    dispatch(closeHallucination()); // Increment counter
  };

  return countHallucination < 3 && !closedHallucination ? (
    <div className="w-full h-10 sticky select-none bg-gray-200 dark:bg-bg_dark m-1 p-2 px-3 rounded-lg flex justify-between items-center shadow-sm dark:shadow-dark">
      <p className="dark:text-white text-black text-xs">
        <Trans i18nKey="description.note1" />
        <Link
          to="https://en.wikipedia.org/wiki/Hallucination_(artificial_intelligence)"
          target="_blank"
          className="text-tertiary"
        >
          &nbsp;
          <Trans i18nKey="description.note6" />
          &nbsp;
        </Link>
        <Trans i18nKey="description.note2" />
        <Link
          to="https://datenschutz.gwdg.de/services/chatai"
          target="_blank"
          className="text-tertiary"
        >
          &nbsp;
          <Trans i18nKey="description.note3" />
          &nbsp;
        </Link>
        <Trans i18nKey="description.note4" />
        <Link
          to="https://gwdg.de/imprint/"
          target="_blank"
          className="text-tertiary"
        >
          &nbsp;
          <Trans i18nKey="description.note5" />
        </Link>
        .
      </p>
      <X
        className="h-[20px] w-[20px] cursor-pointer text-[#009EE0]"
        alt="cross"
        onClick={handleClose}
      />
    </div>
  ) : null;
}
