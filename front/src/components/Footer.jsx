// Importing necessary modules and assets
import { Link } from "react-router-dom"; // For routing
import { Trans, useTranslation } from "react-i18next"; // For internationalization
import arrow_down from "../assets/footer_arrow.svg"; // Arrow icon
import english_flag from "../assets/english_flag.svg"; // English flag icon
import german_flag from "../assets/german_flag.svg"; // German flag icon

// Language list of supported languages with corresponding flag icons
const lngs = {
  en: english_flag,
  de: german_flag,
};

// Footer component
function Footer(props) {
  // Object of i18n lib which has functions that can change language globally
  const { i18n } = useTranslation();

  return (
    <div
      // Conditional CSS classes based on props
      className={`${
        props.showFooter ? "pt-2" : "pt-0"
      } md:h-[12%] md:absolute md:bottom-0 w-full p-3 flex flex-col gap-2 md:gap-0 justify-between select-none shadow-top dark:shadow-darkTop md:px-[50px] bg-white dark:bg-black items-center`}
    >
      {/* Show/Hide footer arrow */}
      <div className="bg-white dark:bg-black h-[20px] pb-4 ">
        <img
          // Click handler to scroll to top and toggle footer visibility
          onClick={() => {
            props.scrollToTop();
            props.setShowFooter(!props.showFooter);
          }}
          className="cursor-pointer h-[15px] w-[55px]"
          src={arrow_down}
        />
      </div>
      {/* Main content of the footer */}
      <div className="flex justify-between w-full bg-white dark:bg-black">
        <div className="flex flex-col gap-3 items-center w-full">
          <div className="grid md:grid-cols-5 grid-cols-1 justify-between w-full gap-y-2">
            {/* Privacy and Security  */}
            <Link
              to={"https://datenschutz.gwdg.de/services/chatai"}
              target="_blank"
            >
              <p className="text-xl text-center h-full text-secondary md:border-r-secondary md:border-r">
                <Trans i18nKey="description.text2"></Trans>
              </p>
            </Link>
            {/* Terms of Use  */}
            <Link
              to={"https://docs.hpc.gwdg.de/services/chat-ai/terms_of_use/index.html"}
              target="_blank"
            >
              <p className="text-xl text-center h-full text-secondary md:border-r-secondary md:border-r">
                <Trans i18nKey="description.text1"></Trans>
              </p>
            </Link>
            {/* FAQ  */}
            <Link
              to={"https://docs.hpc.gwdg.de/services/chat-ai/faq/index.html"}
              target="_blank"
            >
              <p className="text-xl text-center h-full text-secondary md:border-r-secondary md:border-r">
                <Trans i18nKey="description.text8"></Trans>
              </p>
            </Link>
            {/* Contact and Feedback */}
            <Link to={"https://gwdg.de/about-us/contact/"} target="_blank">
              <p className="text-xl text-center h-full text-secondary md:border-r-secondary md:border-r">
                <Trans i18nKey="description.text4"></Trans>
              </p>
            </Link>
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

          {/* Logos only visible in mobile */}
          <div className="flex gap-4 md:hidden">
            {/* Kisski logo */}
            <div className="pr-2">
              <Link to={"https://kisski.gwdg.de/"} target="_blank">
                <div className="md:bg-kisski-logo-large bg-kisski-logo-small md:h-[45px] md:w-[145px] h-[60px] w-[60px] bg-repeat-round"></div>
              </Link>
            </div>
            {/* GWDG logo */}
            <div className="border-l-2 border-primary pl-2">
              <Link to={"https://gwdg.de/"} target="_blank">
                <div className="md:bg-logo-large bg-logo-small md:h-[45px] md:w-[145px] h-[60px] w-[60px] bg-repeat-round"></div>
              </Link>
            </div>
          </div>

          {/* Copyrights and Powered by */}
          <div className="flex flex-col md:flex-row justify-center items-center gap-4 dark:text-white text-black md:border-none border-t border-b w-full md:p-0 py-2">
            <p>
              © 2024 GWDG | <Trans i18nKey="description.copyright"></Trans>
            </p>
          </div>
        </div>

        {/* Language selection */}
        <div className="flex gap-4 flex-col">
          {/* Display language buttons */}
          {Object.keys(lngs).map((lng) => (
            <button
              key={lng}
              // Set bold font weight for the currently selected language
              style={{
                fontWeight: i18n.resolvedLanguage === lng ? "bold" : "normal",
              }}
              type="submit"
              // Click handler to change language
              onClick={() => i18n.changeLanguage(lng)}
            >
              {/* Display flag icon */}
              <img src={lngs[lng]} alt={lngs[lng].nativeName} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Footer;
