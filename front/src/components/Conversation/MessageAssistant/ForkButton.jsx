import { Workflow } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function ForkButton({ handleForkConversation }) {
    const { t } = useTranslation();
    return (
        <button onClick={handleForkConversation} title={t("common.fork")} className=" h-[20px] w-[20px] cursor-pointer disabled:opacity-40">
            {" "}
            <Workflow
                className="opacity-25 group-hover:opacity-100 transition-opacity duration-300 h-[20px] w-[20px] cursor-pointer text-accent"
                alt="fork_icon"
            />
        </button>
    );
}
