import { Link } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";

export default function NavigationGridLinks() {
    return (
    <div className="grid md:grid-cols-5 grid-cols-2 justify-between w-full gap-y-2">
        {/* Documentation Link */}
        <Link
        to={
            "https://docs.hpc.gwdg.de/services/chat-ai/index.html"
        }
        target="_blank"
        className = "hidden md:block"
        >
        <p className="text-base text-center h-full text-secondary md:border-r-secondary md:border-r">
            <Trans i18nKey="footer.docs" />
        </p>
        </Link>

        {/* Terms of Use Link */}
        <Link
        to={
            "https://docs.hpc.gwdg.de/services/chat-ai/terms_of_use.de/index.html"
        }
        target="_blank"
        >
        <p className="text-base text-center h-full text-secondary md:border-r-secondary md:border-r">
            <Trans i18nKey="footer.terms"></Trans>
        </p>
        </Link>

        {/* FAQ Link */}
        <Link
        to={"https://docs.hpc.gwdg.de/services/chat-ai/faq/index.html"}
        target="_blank"
        >
        <p className="text-base text-center h-full text-secondary md:border-r-secondary md:border-r">
            <Trans i18nKey="footer.faq"></Trans>
        </p>
        </Link>

        {/* Contact and Feedback Link */}
        <Link to={"https://gwdg.de/about-us/contact/"} target="_blank">
        <p className="text-base text-center h-full text-secondary md:border-r-secondary md:border-r">
            <Trans i18nKey="footer.contact"></Trans>
        </p>
        </Link>

        {/* Information Link */}
        <Link
        to={
            "https://kisski.gwdg.de/en/leistungen/2-02-llm-service/"
        }
        target="_blank"
        >
        <p className="text-base text-center h-full text-secondary">
            <Trans i18nKey="footer.about"></Trans>
        </p>
        </Link>
    </div>
    );
}