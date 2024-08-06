/* eslint-disable react/prop-types */ // Disabling prop-types linting for this file

// Importing necessary modules
import { useEffect } from "react";

// Modal component
function Modal(props) {
  // useEffect hook to handle keyboard events
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        // Close the modal when the Escape key is pressed
        props.showModal(false);
        // If setActionButtonToggle prop is provided, set it to false
        if (props.setActionButtonToggle) {
          props.setActionButtonToggle(false);
        }
      }
    };

    // Adding event listener for keydown event
    window.addEventListener("keydown", handleKeyDown);

    // Removing event listener when component unmounts
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []); // Empty dependency array ensures this effect runs only once on mount

  return (
    // Modal layout component
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center w-full h-full"
      onClick={() => {
        // Close the modal when clicked outside of it
        props.showModal(false);
        // If setActionButtonToggle prop is provided, set it to false
        if (props.setActionButtonToggle) {
          props.setActionButtonToggle(false);
        }
      }}
    >
      {/* Background overlay */}
      <div
        className={`absolute w-full h-full bg-black ${
          props.isAlertModal ? "opacity-100" : "opacity-70"
        }`}
      ></div>
      {/* Modal content */}
      <div
        className="absolute flex flex-col justify-center sm:w-fit shadow-lg outline-none focus:outline-none w-[calc(100%-32px)]"
        onClick={(e) => {
          e.stopPropagation(); // Prevent closing modal when clicked inside it
        }}
      >
        {/* Render children components passed to the modal */}
        {props.children}
      </div>
    </div>
  );
}

export default Modal;
