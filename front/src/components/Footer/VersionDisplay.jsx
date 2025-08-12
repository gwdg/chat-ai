import packageJson from "../../../package.json";
import { Trans, useTranslation } from "react-i18next";

export default function VersionDisplay() {
    return (
    <div className="flex flex-col md:flex-row justify-center items-center gap-4 dark:text-white text-black md:border-none border-t border-b w-full md:p-0 py-2">
        <p className="flex items-center gap-2">
        <a
            href="https://github.com/gwdg/chat-ai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center"
        >
            {packageJson.displayName}
            {" v"}
            {packageJson.version}
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
        | © 2025 GWDG | <Trans i18nKey="description.copyright"></Trans>
        </p>
    </div>
    );
}