import HamburgerMenu from "./HamburgerMenu";
import LogoContainer from "./LogoContainer";
import ModelSelector from "./ModelSelector";
import PartnerContainer from "./PartnerContainer";
import ThemeToggle from "./ThemeToggle";
import UserContainer from "./UserContainer";

function Header({ localState, setLocalState, modelsData, userData }) {
  return (
    <>
      {/* TODO debug AnnouncementBar */}
      {/* <AnnouncementBar /> */}
      {/* Desktop Header - Show above desktop breakpoint (1281px) */}
      <nav className="desktop:flex hidden top-0 h-14 px-4 items-center justify-between left-0 z-[995] w-full bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800">
        {/* Left Section */}
        <div className="flex items-center gap-3">
          {/* Hamburger Menu - Show when settings panel is open (collapsed sidebar hidden) */}
          {/* <HamburgerMenu  /> */}
          {/* Theme toggle */}
          <ThemeToggle />
          {/* Logo */}
          <LogoContainer />
        </div>

        {/* Center Section */}
        <div
          className="flex-shrink flex-grow min-w-0 px-2 relative"
          style={{ maxWidth: "calc(100vw - 200px)" }}
          tabIndex={0}
        >
          {/* Model Selection 
          <ModelSelector
            localState={localState}
            setLocalState={setLocalState}
            modelsData={modelsData}
          />*/}
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-3">
          {/* Partner logos */}
          <PartnerContainer />
          {/* User profile */}
          <UserContainer
            localState={localState}
            setLocalState={setLocalState}
            userData={userData}
            modelsData={modelsData}
          />
        </div>
      </nav>

      {/* Mobile/Tablet Header - Show below desktop breakpoint (1281px) */}
      <nav className="desktop:hidden flex top-0 left-0 z-[995] w-full h-14 bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800">
        <div className="w-full px-4 flex items-center gap-3">
          {/* Left Section */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Hamburger Menu - Always show on mobile/tablet */}
            <HamburgerMenu />
            {/* Logo (Mobile) */}
            <LogoContainer isMobile={true} />
          </div>

          {/* Center Section */}
          <div
            className="flex-shrink flex-grow min-w-0 px-2 relative"
            style={{ maxWidth: "calc(100vw - 200px)" }}
            tabIndex={0}
          >
            {/* Model Selection 
            <ModelSelector
              localState={localState}
              setLocalState={setLocalState}
              modelsData={modelsData}
            />*/}
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Theme Toggle */}
            <ThemeToggle />
            {/* User profile */}
            <UserContainer
              localState={localState}
              setLocalState={setLocalState}
              userData={userData}
              modelsData={modelsData}
            />
          </div>
        </div>
      </nav>
    </>
  );
}

export default Header;
