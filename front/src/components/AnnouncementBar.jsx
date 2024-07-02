import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import cross from "../assets/cross_white.svg";

//This component is here for important announcement, when user closes it thrice it will disappear.
function AnnouncementBar(props) {
  const { t } = useTranslation();

  return (
    <nav
      // Conditional CSS classes based on location and dark mode state
      className={`px-2 py-[2px] md:flex hidden gap-1 justify-between items-center select-none w-full fixed top-0 z-[990] text-white text-xs bg-red-600 h-[30px] max-h-[30px] ${
        location.pathname === "/chat"
          ? "md:shadow-lg md:dark:shadow-dark"
          : "shadow-lg dark:shadow-dark "
      }`}
    >
      <div className="flex gap-1 justify-between items-center">
        {" "}
        <Link
          to={
            "https://info.gwdg.de/news/aenderungen-an-der-verfuegbarkeit-von-chat-ai-modellen/"
          }
          target="_blank"
        >
          <p className="h-full underline">
            {t("description.titleAnnouncement")}{" "}
          </p>
        </Link>
      </div>
      <img
        src={cross}
        alt="cross"
        className="h-[30px] w-[30px] cursor-pointer"
        onClick={() => {
          props.anncCounter();
        }}
      />
    </nav>
  );
}

export default AnnouncementBar;
