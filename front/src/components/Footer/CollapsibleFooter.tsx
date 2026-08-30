import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import { faChevronUp, faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import VersionDisplay from "./VersionDisplay";
import LanguageSelector from "./LanguageSelector";
import { Link } from "react-router";
import { Trans } from "react-i18next";
import ThemeToggle from "../Header/ThemeToggle";

export default function CollapsibleFooter({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const currentYear = new Date().getFullYear();

  return (
    <footer className={`bg-white rounded-xl dark:bg-bg_secondary_dark text-xs md:text-sm ${className}`}>
      {/* Header / handle: always visible */}
      <div className="relative">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="footer-content"
          onClick={() => {}}
          className="w-full h-[3vh] flex items-center justify-center gap-2 rounded-t-xl"
        >
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
            to={
              "https://gwdg.de/imprint/"
            }
            target="_blank"
          >
            <p className="text-center text-blue-600 dark:text-blue-400 hover:underline">
              <Trans i18nKey="footer.imprint" />
            </p>
          </Link>
          {/* Documentation */}
          <Link
            to={
              "https://docs.hpc.gwdg.de/services/ai-services/chat-ai/index.html"
            }
            target="_blank"
          >
            <p className="text-center h-full text-blue-600 dark:text-blue-400 hover:underline">
              <Trans i18nKey="footer.docs" />
            </p>
          </Link>
          {/* Terms of use */}
          <Link
            to={
              "https://docs.hpc.gwdg.de/services/chat-ai/terms_of_use.de/index.html"
            }
            target="_blank"
          >
            <p className="text-center whitespace-nowrap truncate text-blue-600 dark:text-blue-400 hover:underline">
              <Trans i18nKey="footer.terms" />
            </p>
          </Link>
        </div>

        {/* Right section */}
        <div className="interface-toggles absolute h-[3vh] right-0 top-0 flex items-center pr-3 gap-2"> 
          <p className="hidden md:block text-center w-full flex flex-grow whitespace-nowrap overflow-visible text-gray-700 dark:text-purple-100">
            <Trans i18nKey="footer.iso_certified" />
          </p>
          <ThemeToggle />
          <LanguageSelector />
        </div>

      </div>


     
    </footer>
  );
}
