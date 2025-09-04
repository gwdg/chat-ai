import { useDispatch } from "react-redux";
import HamburgerMenu from "./HamburgerMenu";
import LogoContainer from "./LogoContainer";
import UserContainer from "./UserContainer";
import { toggleSidebar } from "../../Redux/reducers/interfaceSettingsSlice";
import SettingsWrapper from "../SettingsPanel/SettingsWrapper";
import SettingsButton from "./SettingsButton";
import ModelSelectorWrapper from "./ModelSelectorWrapper";
import ModelSelector from "./ModelSelector";
import WarningExternalModel from "./WarningExternalModel";
import AnnouncementBar from "./AnnouncementBar";

function Header({ className, localState, setLocalState, modelsData, userData }) {
  const dispatch = useDispatch();
  return (
    <>
      
      {/* Mobile/Tablet Header - Show below desktop breakpoint (1281px) */}
      <nav className={`${className} flex top-0 left-0 z-[995] w-full h-14 bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800`}>
        <div className="w-full pr-4 pl-2 flex items-center gap-3">
          {/* Left Section */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Hamburger Menu - Always show on mobile/tablet */}
            <HamburgerMenu />
            {/* Small Logo (Mobile) */}
            <LogoContainer isMobile={true} />
          </div>

          {/* Center Section - Model Selector*/}
          <div
            className="flex-grow min-w-0 relative w-full"
            style={{ maxWidth: "calc(100vw - 50px)" }}
            tabIndex={0}
          >
            <ModelSelectorWrapper
              localState={localState}
              setLocalState={setLocalState}
              modelsData={modelsData}
              inHeader={true}
            />
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-3">
            {/* External Model Warning */}
            <WarningExternalModel localState={localState} userData={userData} />
            {/* Settings Button */}
            <SettingsButton
              localState={localState}
              setLocalState={setLocalState}
             />
          </div>
        </div>
      </nav>
    </>
  );
}

export default Header;
