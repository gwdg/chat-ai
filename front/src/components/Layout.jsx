// Importing necessary modules
import { useEffect, useRef, useState } from "react"; // For managing component state and references
import Header from "./Header"; // Importing Header component
import Footer from "./Footer"; // Importing Footer component

// Assets
import arrow_down from "../assets/footer_arrow.svg"; // Footer arrow icon
// import AnnouncementBar from "./AnnouncementBar";
// import { useDispatch, useSelector } from "react-redux";
// import { setAnncCountGlobal } from "../Redux/actions/anncAlertAction";

function Layout(props) {
  // const countClose = useSelector((state) => state.anncCount);

  // const dispatch = useDispatch();

  // State for footer hide/show
  const [showFooter, setShowFooter] = useState(false);
  // const [showAnnc, setShowAnnc] = useState(countClose > 3 ? false : true);
  // const [count, setCount] = useState(countClose);
  const mainDiv = useRef(null); // Reference to the main content div

  //Announcement alert count handler
  // const anncCounter = () => {
  //   setShowAnnc(false);
  //   dispatch(setAnncCountGlobal(count + 1));
  //   setCount(function (prevCount) {
  //     return (prevCount += 1);
  //   });
  // };

  // Function to scroll to the bottom of the main content
  const scrollToBottom = () => {
    if (mainDiv.current) {
      mainDiv.current.scrollTop = mainDiv.current.scrollHeight;
    }
  };

  // Function to scroll to the top of the main content
  const scrollToTop = () => {
    if (mainDiv.current) {
      mainDiv.current.scrollTop = 0;
    }
  };

  useEffect(() => {
    scrollToTop();
  }, []);

  return (
    // Main layout container
    <div className="flex flex-col min-h-screen md:gap-4 relative no-scrollbar h-full">
      {/* Announcement bar */}
      {/* {showAnnc && count < 3 ? (
        <AnnouncementBar anncCounter={anncCounter} />
      ) : null} */}

      {/* Header component */}
      <Header className="" />

      {/* Main content area */}
      <div
        ref={mainDiv} // Reference to the main content div
        className={`md:pt-[65px] flex flex-col overflow-y-auto pt-0 bg-white dark:bg-black relative gap-0 h-full`}
      >
        {/* Content passed as props */}
        <div
          className={`${
            showFooter ? "h-[89%] pb-2 grow-0" : "h-screen flex-grow"
          } bg-bg_light dark:bg-bg_dark overflow-x-hidden`}
        >
          {props.children}
        </div>
        {/* Show/hide footer arrow button */}
        {!showFooter ? (
          <div className="flex justify-center items-center h-[22px] py-2 bg-bg_light dark:bg-bg_dark">
            {/* Click handler to toggle footer visibility */}
            <img
              onClick={() => {
                setShowFooter(!showFooter); // Toggle footer visibility
                setTimeout(scrollToBottom, 0); // Scroll to bottom after toggling
              }}
              className="cursor-pointer h-[15px] w-[55px] rotate-180"
              src={arrow_down} // Footer arrow icon
            />
          </div>
        ) : null}
        {/* Footer component */}
        {showFooter ? (
          <Footer
            showFooter={showFooter}
            setShowFooter={setShowFooter}
            scrollToTop={scrollToTop}
          />
        ) : null}
      </div>
    </div>
  );
}

export default Layout;
