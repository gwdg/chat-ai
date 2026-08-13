import { GitFork } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function ForkButton({ handleForkConversation }) {
    const { t } = useTranslation();
    return (
        <button onClick={handleForkConversation} title={t("common.fork")} className=" h-[22px] w-[22px] cursor-pointer disabled:opacity-40">
            {" "}
            <GitFork
                className="opacity-20 group-hover:opacity-100 transition-opacity duration-300 h-[22px] w-[22px] cursor-pointer text-[#009EE0]"
                alt="fork_icon"
            />
        </button>
    );
}
