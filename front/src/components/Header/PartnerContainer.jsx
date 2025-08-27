import { Link } from "react-router-dom";

export default function PartnerContainer({ isMobile = false }) {
  return !isMobile ? (
    <div className="hidden middle:flex desktop:flex items-center gap-5 justify-start w-full">
        <Link to={"https://kisski.gwdg.de/"} target="_blank">
            <div className="bg-kisski-logo-large h-8 w-28 bg-repeat-round transition-all hover:opacity-80 rounded"></div>
        </Link>
        <Link to={"https://gwdg.de/"} target="_blank">
            <div className="bg-gwdg-logo-large h-8 w-28 bg-repeat-round transition-all hover:opacity-80 rounded"></div>
        </Link>
    </div>
  ) : (<div></div>);
}