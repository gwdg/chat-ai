import { Link } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";

export default function NavigationGridLinks() {
    return (
    <div className="grid md:grid-cols-5 grid-cols-1 justify-between w-full gap-y-2">
        {/* Privacy and Security Link */}
        <Link
        to={
            "https://docs.hpc.gwdg.de/services/chat-ai/data-privacy.de/index.html"
        }
        target="_blank"
        >
        <p className="text-base text-center h-full text-secondary md:border-r-secondary md:border-r">
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
        <p className="text-base text-center h-full text-secondary md:border-r-secondary md:border-r">
            <Trans i18nKey="description.text1"></Trans>
        </p>
        </Link>

        {/* FAQ Link */}
        <Link
        to={"https://docs.hpc.gwdg.de/services/chat-ai/faq/index.html"}
        target="_blank"
        >
        <p className="text-base text-center h-full text-secondary md:border-r-secondary md:border-r">
            <Trans i18nKey="description.text8"></Trans>
        </p>
        </Link>

        {/* Contact and Feedback Link */}
        <Link to={"https://gwdg.de/about-us/contact/"} target="_blank">
        <p className="text-base text-center h-full text-secondary md:border-r-secondary md:border-r">
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
        <p className="text-base text-center h-full text-secondary">
            <Trans i18nKey="description.text7"></Trans>
        </p>
        </Link>
    </div>
    );
}