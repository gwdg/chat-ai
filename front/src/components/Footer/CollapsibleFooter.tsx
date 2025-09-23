import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import { faChevronUp, faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import NavigationGridLinks from "./NavigationLinksGrid";
import VersionDisplay from "./VersionDisplay";
import PartnerLogo from "./PartnerLogo";
import LanguageSelector from "./LanguageSelector";
import { Link } from "react-router";
import { Trans } from "react-i18next";
import ThemeToggle from "../Header/ThemeToggle";

export default function CollapsibleFooter({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <footer className={`bg-white rounded-xl dark:bg-bg_secondary_dark text-sm ${className}`}>
      {/* Header / handle: always visible */}
      <div className="relative">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="footer-content"
          onClick={() => setOpen(v => !v)}
          className="w-full h-[3vh] flex items-center justify-center gap-2 hover:bg-light_hover dark:hover:bg-dark_hover focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-t-xl cursor-pointer"
        >
          <FontAwesomeIcon
            icon={faChevronUp}
            className={`size-5 text-tertiary transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </button>
        <div className="absolute h-[3vh] left-0 top-0 flex items-center justify-center pl-3 gap-3">
          {/* Version Display - Desktop and Tablet */}
          <div className="hidden md:block flex flex-col md:flex-row justify-center items-center gap-4 dark:text-white text-black w-full md:p-0 py-2">
            <VersionDisplay />
          </div>
          {/* Privacy Policy */}
          <Link
          to={
              "https://docs.hpc.gwdg.de/services/chat-ai/data-privacy.de/index.html"
          }
          target="_blank"
          >
          <p className="text-center text-blue-600 dark:text-blue-400 hover:underline">
              <Trans i18nKey="footer.privacy"></Trans>
          </p>
          </Link>
          {/* Imprint */}
          <Link
            className="justify-center"
            to={
              "https://gwdg.de/imprint/"
            }
            target="_blank"
          >
            <p className="text-center text-blue-600 dark:text-blue-400 hover:underline">
              <Trans i18nKey="footer.imprint" />
            </p>
          </Link>
          
        </div>

        {/* Right section */}
        <div className="interface-toggles absolute h-[3vh] right-0 top-0 flex items-center pr-3 gap-2"> 
          <p className="hidden md:block text-center w-full flex flex-grow whitespace-nowrap overflow-visible text-gray-600 dark:text-gray-400">
            <Trans i18nKey="footer.iso_certified" />
          </p>
          <ThemeToggle />
          <LanguageSelector />
        </div>

      </div>


      {/* Animated content wrapper */}
      <div
        id="footer-content"
        role="region"
        aria-hidden={!open}
        // Smooth height animation using max-height
        className={`
          transition-[max-height] duration-300 ease-in-out
          ${open ? "max-h-[300px] " : "max-h-0"}
          overflow-hidden
        `}
      >
        {/* Optional fade on content appear */}
        <div className={`px-4 pb-2 pt-2 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}>
          <div className="flex justify-between w-full">
            {/* Main Section */}
            <div className="flex flex-col gap-3 items-center w-full">
              {/* Partner Logo Section (Mobile-Only) */}
              <PartnerLogo className="md:hidden" />
              {/* Navigation Links Grid */}
              <NavigationGridLinks />
              {/* Version Display and ISO certified - Mobile only */}
              <div className="block md:hidden justify-center text-center w-full flex flex-grow whitespace-nowrap overflow-visible text-gray-600 dark:text-gray-400 gap-x-2">
                <VersionDisplay />
                <Trans i18nKey="footer.iso_certified" />
              </div>
              <div>
                <Trans i18nKey="footer.copyright"/>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

