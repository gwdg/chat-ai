// Importing necessary modules
import { Trans } from "react-i18next"; // For translation
import Model from "./Model"; // Importing Model component
import cross from "../assets/cross.svg"; // Close icon

function Help_Aracana(props) {
  return (
    // Model component with help content
    <Model showModel={props.showModel}>
      <div className="select-none border dark:border-border_dark rounded-2xl bg-white dark:bg-black w-full">
        {/* Model header */}
        <div className="flex justify-between items-center px-4 pt-4">
          <p className="text-xl text-tertiary">
            {/* Translation for help title */}
            <Trans i18nKey="description.help_arcana_title"></Trans>:
          </p>
          {/* Close button */}
          <img
            src={cross}
            alt="cross"
            className="h-[30px] w-[30px] cursor-pointer"
            onClick={() => props.showModel(false)} // Click handler to close model
          />
        </div>
        {/* Help content */}
        <div className="p-4 pt-0">
          <p className="dark:text-white text-black text-justify">
            {/* Translation for help note */}
            <Trans i18nKey="description.help_arcana_note"></Trans>
          </p>
        </div>
      </div>
    </Model>
  );
}

export default Help_Aracana;
