// Importing necessary modules
import { Trans } from "react-i18next"; // For translation
import Model from "./Model"; // Importing Model component
import cross from "../assets/cross.svg"; // Close icon

// Custom instructions model component
function Cutom_Instructions_Model(props) {
  return (
    // Model component with custom instructions content
    <Model showModel={props.showModel}>
      <div className="select-none border dark:border-border_dark rounded-2xl bg-white dark:bg-black md:min-w-[700px] h-fit md:max-w-[350px]">
        {/* Model header */}
        <div className="flex justify-between items-center px-4 pt-4">
          <p className="text-xl text-tertiary">
            {/* Translation for help title */}
            <Trans i18nKey="description.help_title"></Trans>:
          </p>
          {/* Close button */}
          <img
            src={cross}
            alt="cross"
            className="h-[30px] w-[30px] cursor-pointer"
            onClick={() => props.showModel(false)} // Click handler to close model
          />
        </div>
        {/* Model body */}
        <div className="p-4 pt-0">
          <p className="dark:text-white text-black text-justify">
            {/* Translation for custom instructions */}
            <Trans i18nKey="description.custom"></Trans>
          </p>
        </div>
      </div>
    </Model>
  );
}

export default Cutom_Instructions_Model;
