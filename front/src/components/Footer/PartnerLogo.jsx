import { Link } from "react-router-dom";

export default function PartnerLogo({className}) {
    return (
    <div className={`flex gap-4 ${className}`}>
        {/* Kisski Logo - Mobile */}
        <div className="pr-2">
        <Link to={"https://kisski.gwdg.de/"} target="_blank">
            <div className="md:bg-kisski-logo-large bg-kisski-logo-small md:h-[45px] md:w-[145px] h-[60px] w-[60px] bg-repeat-round"></div>
        </Link>
        </div>

        {/* GWDG Logo - Mobile */}
        <div className="border-l-2 border-primary pl-2">
        <Link to={"https://gwdg.de/"} target="_blank">
            <div className="md:bg-gwdg-logo-large bg-gwdg-logo-small md:h-[45px] md:w-[145px] h-[60px] w-[60px] bg-repeat-round"></div>
        </Link>
        </div>
    </div>
    );
}