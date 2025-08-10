// External dependencies
import ShowFooterButton from "./ShowFooterButton"
import HideFooterButton from "./HideFooterButton";

// Asset imports
import NavigationGridLinks from "./NavigationLinksGrid";
import VersionDisplay from "./VersionDisplay";
import PartnerLogo from "./PartnerLogo";
import LanguageSelector from "./LanguageSelector";

function Footer(props) {
  return (
    <div className="w-full bg-bg_light dark:bg-bg_dark flex-shrink-0 select-none">
    {/*Footer - Hidden */}
    {!props.showFooter && (
      // Show Footer Button
      <ShowFooterButton toggleFooter={props.toggleFooter}/>
    )} {props.showFooter && (
    <div className="desktop:rounded-2xl desktop:mb-3 bg-white dark:bg-black shadow-lg dark:shadow-dark overflow-hidden">
      {/* Foot - Visible */}
      <div
        className={`${
          props.showFooter ? "pt-2" : "pt-0"
        } md:h-[11%] md:absolute md:bottom-0 w-full p-3 flex flex-col gap-2 md:gap-0 justify-between select-none shadow-top dark:shadow-darkTop md:px-[50px] bg-white dark:bg-black items-center`}
      >
        {/* Hide FooterButton */}
        <HideFooterButton
          toggleFooter={props.toggleFooter}
          scrollToTop={props.scrollToTop}
        />
        {/* Footer Content*/}
        <div className="flex justify-between w-full bg-white dark:bg-black">
          {/* Main Section */}
          <div className="flex flex-col gap-3 items-center w-full">
            {/* Navigation Links Grid */}
            <NavigationGridLinks /> 
            {/* Partner Logo Section (Mobile-Only) */}
            <PartnerLogo />
            {/* Version Display */}   
            <VersionDisplay />      
          </div>
          {/* Right Section - Language Selector */}
          <LanguageSelector />
        </div>
      </div>
    </div>)}
    </div>
  );
}

export default Footer;
