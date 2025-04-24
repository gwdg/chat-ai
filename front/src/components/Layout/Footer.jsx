/**
 * Footer Component for the Chat AI application
 * Provides navigation links, language selection, and copyright information
 * Supports both desktop and mobile layouts with responsive design
 */

// External dependencies
import { Link } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";

// Asset imports
import arrow_down from "../../assets/footer_arrow.svg";
import english_flag from "../../assets/english_flag.svg";
import german_flag from "../../assets/german_flag.svg";

// Language configuration object mapping language codes to their flag icons
const lngs = {
  en: english_flag,
  de: german_flag,
};

function Footer(props) {
  // Initialize internationalization hooks
  const { i18n } = useTranslation();

  return (
    <div
      className={`${
        props.showFooter ? "pt-2" : "pt-0"
      } md:h-[11%] md:absolute md:bottom-0 w-full p-3 flex flex-col gap-2 md:gap-0 justify-between select-none shadow-top dark:shadow-darkTop md:px-[50px] bg-white dark:bg-black items-center`}
    >
      {/* Footer Toggle Button */}
      <div className="bg-white dark:bg-black h-[20px] pb-4 ">
        <img
          onClick={() => {
            props.scrollToTop();
            props.setShowFooter(!props.showFooter);
          }}
          className="cursor-pointer h-[15px] w-[55px]"
          src={arrow_down}
          alt="Toggle footer"
        />
      </div>

      {/* Footer Content Container */}
      <div className="flex justify-between w-full bg-white dark:bg-black">
        <div className="flex flex-col gap-3 items-center w-full">
          {/* Navigation Links Grid */}
          <div className="grid md:grid-cols-5 grid-cols-1 justify-between w-full gap-y-2">
            {/* Privacy and Security Link */}
            <Link
              to={
                "https://docs.hpc.gwdg.de/services/chat-ai/data-privacy.de/index.html"
              }
              target="_blank"
            >
              <p className="text-xl text-center h-full text-secondary md:border-r-secondary md:border-r">
                <Trans i18nKey="description.text2"></Trans>
              </p>
            </Link>

            {/* Terms of Use Link */}
            <Link
              to={
                "https://docs.hpc.gwdg.de/services/chat-ai/terms_of_use.de/index.html"
              }
              target="_blank"
            >
              <p className="text-xl text-center h-full text-secondary md:border-r-secondary md:border-r">
                <Trans i18nKey="description.text1"></Trans>
              </p>
            </Link>

            {/* FAQ Link */}
            <Link
              to={"https://docs.hpc.gwdg.de/services/chat-ai/faq/index.html"}
              target="_blank"
            >
              <p className="text-xl text-center h-full text-secondary md:border-r-secondary md:border-r">
                <Trans i18nKey="description.text8"></Trans>
              </p>
            </Link>

            {/* Contact and Feedback Link */}
            <Link to={"https://gwdg.de/about-us/contact/"} target="_blank">
              <p className="text-xl text-center h-full text-secondary md:border-r-secondary md:border-r">
                <Trans i18nKey="description.text4"></Trans>
              </p>
            </Link>

            {/* Information Link */}
            <Link
              to={
                "https://info.gwdg.de/news/en/gwdg-llm-service-generative-ai-for-science/"
              }
              target="_blank"
            >
              <p className="text-xl text-center h-full text-secondary">
                <Trans i18nKey="description.text7"></Trans>
              </p>
            </Link>
          </div>

          {/* Mobile-only Logo Section */}
          <div className="flex gap-4 md:hidden">
            {/* Kisski Logo - Mobile */}
            <div className="pr-2">
              <Link to={"https://kisski.gwdg.de/"} target="_blank">
                <div className="md:bg-kisski-logo-large bg-kisski-logo-small md:h-[45px] md:w-[145px] h-[60px] w-[60px] bg-repeat-round"></div>
              </Link>
            </div>

            {/* GWDG Logo - Mobile */}
            <div className="border-l-2 border-primary pl-2">
              <Link to={"https://gwdg.de/"} target="_blank">
                <div className="md:bg-logo-large bg-logo-small md:h-[45px] md:w-[145px] h-[60px] w-[60px] bg-repeat-round"></div>
              </Link>
            </div>
          </div>

          {/* Copyright Section */}
          <div className="flex flex-col md:flex-row justify-center items-center gap-4 dark:text-white text-black md:border-none border-t border-b w-full md:p-0 py-2">
            <p className="flex items-center gap-2">
              <a
                href="https://github.com/gwdg/chat-ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center"
              >
                Chat AI v0.7.3
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  className="w-3 h-3 ml-1 mb-0.5"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                </svg>
              </a>{" "}
              | © 2024 GWDG | <Trans i18nKey="description.copyright"></Trans>
            </p>
          </div>
        </div>

        {/* Language Selection Section */}
        <div className="flex gap-4 flex-col">
          {/* Language Toggle Buttons */}
          {Object.keys(lngs).map((lng) => (
            <button
              key={lng}
              style={{
                fontWeight: i18n.resolvedLanguage === lng ? "bold" : "normal",
              }}
              type="submit"
              onClick={() => i18n.changeLanguage(lng)}
            >
              <img src={lngs[lng]} alt={`${lng} language flag`} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Footer;
