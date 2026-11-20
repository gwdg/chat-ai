import { Link } from "react-router-dom";
import { Trans } from "react-i18next";
import { useSelector, useDispatch } from "react-redux";
import { useState } from "react";
//Assets
import { X } from "lucide-react";

import {
  selectCountHallucination,
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
    <div className="mx-auto w-full max-w-3xl select-none rounded-lg border border-base-300 bg-base-100 px-3 py-2 flex justify-between items-center gap-2 shadow-sm dark:shadow-dark">
      <p className="text-base-content text-sm">
        <Trans i18nKey="alert.hallucination.note1" />
        <Link
          to="https://en.wikipedia.org/wiki/Hallucination_(artificial_intelligence)"
          target="_blank"
          className="text-accent"
        >
          &nbsp;
          <Trans i18nKey="alert.hallucination.note3" />
          &nbsp;
        </Link>
        <Trans i18nKey="alert.hallucination.note2" />
      </p>
      <X
        className="h-[20px] min-w-[20px] shrink-0 cursor-pointer text-accent"
        alt="cross"
        onClick={handleClose}
      />
    </div>
  ) : null;
}
