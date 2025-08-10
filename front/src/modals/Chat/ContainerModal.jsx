/* eslint-disable react/prop-types */ // Disabling prop-types linting for this file

// Importing necessary modules
import { useEffect, useRef } from "react";

// Global modal stack to track which modal should handle ESC
let modalStack = [];
let modalIdCounter = 0;

// Model component
function Model(props) {
  const modalId = useRef(null);

  useEffect(() => {
    // Generate unique ID for this modal instance
    modalId.current = modalIdCounter++;

    // Add this modal to the stack when it mounts
    modalStack.push(modalId.current);

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !props.isForceAction) {
        // Only handle ESC if this is the topmost modal in the stack
        const isTopModal =
          modalStack[modalStack.length - 1] === modalId.current;

        if (isTopModal) {
          event.stopPropagation();
          event.preventDefault();

          props.showModal(false);
          if (props.setActionButtonToggle) {
            props.setActionButtonToggle(false);
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    // Cleanup function
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      // Remove this modal from the stack when it unmounts
      modalStack = modalStack.filter((id) => id !== modalId.current);
    };
  }, [props.isForceAction, props.showModal, props.setActionButtonToggle]);

  // Determine z-index based on modal type
  const getZIndex = () => {
    if (props.isConfirmationModal) return "z-[1200]"; // Highest for confirmation modals
    if (props.isMemoryModal) return "z-[1100]"; // Memory modal
    if (props.isSettingsModel) return "z-[1000]"; // Settings modal
    return "z-[999]"; // Default modal z-index
  };

  return (
    <div
      className={`fixed inset-0 ${getZIndex()} flex items-center justify-center w-full h-full`}
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
