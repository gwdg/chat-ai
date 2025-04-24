/* eslint-disable react/prop-types */ // Disabling prop-types linting for this file

// Importing necessary modules
import { useEffect } from "react";

// Model component
function Model(props) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Only close on Escape if not a forced action modal
      if (event.key === "Escape" && !props.isForceAction) {
        props.showModal(false);
        if (props.setActionButtonToggle) {
          props.setActionButtonToggle(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div
      className={`fixed inset-0 ${
        props.isSettingsModel ? "z-[999]" : "z-[1000]"
      } flex items-center justify-center w-full h-full`}
      onClick={() => {
        // Only close on outside click if not a forced action modal
        if (!props.isForceAction) {
          props.showModal(false);
          if (props.setActionButtonToggle) {
            props.setActionButtonToggle(false);
          }
        }
      }}
    >
      <div
        className={`absolute w-full h-full bg-black ${
          props.isAlertModal ? "opacity-100" : "opacity-70"
        }`}
      ></div>
      <div
        className="absolute flex flex-col justify-center items-center max-w-[700px] shadow-lg outline-none focus:outline-none w-[calc(100%-32px)]"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        {props.children}
      </div>
    </div>
  );
}

export default Model;
