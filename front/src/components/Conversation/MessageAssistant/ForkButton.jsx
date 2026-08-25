import { Workflow } from "lucide-react";

export default function ForkButton({ handleForkConversation }) {
    return (
        <button onClick={handleForkConversation} title="Continue in new chat" className=" h-[20px] w-[20px] cursor-pointer disabled:opacity-40">
            {" "}
            <Workflow
                className="opacity-25 group-hover:opacity-100 transition-opacity duration-300 h-[20px] w-[20px] cursor-pointer text-[#009EE0]"
                alt="fork_icon"
            />
        </button>
    );
}
