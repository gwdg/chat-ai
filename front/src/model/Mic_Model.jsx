// Importing necessary modules
import { Trans } from "react-i18next"; // For translation
import Model from "./Model"; // Importing Model component
import cross from "../assets/cross.svg"; // Close icon

// Mic model component
function Mic_Model(props) {
  return (
    // Model component with mic permission message
    <Model showModel={props.showModel}>
      <div className="border dark:border-border_dark rounded-2xl bg-white dark:bg-black md:min-w-[350px] h-fit md:max-w-[350px]">
        {/* Model header */}
        <div className="flex justify-between items-center px-4 pt-4">
          <p className="text-xl text-tertiary">
            {/* Translation for mic permission message */}
            <Trans i18nKey="description.mic2"></Trans>
          </p>
          {/* Close button */}
          <img
            src={cross}
            alt="cross"
            className="h-[30px] w-[30px] cursor-pointer"
            onClick={() => props.showModel(false)} // Click handler to close model
          />
        </div>
        {/* Mic permission message */}
        <div className="p-4 pt-0">
          <p className="dark:text-white text-black text-justify">
            {/* Translation for mic permission message */}
            <Trans i18nKey="description.mic1"></Trans>
          </p>
        </div>
      </div>
    </Model>
  );
}

export default Mic_Model;
