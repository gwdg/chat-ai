import { useState, useCallback, useEffect} from "react";

import icon_copy from "../../../assets/icons/copy.svg";
import icon_check from "../../../assets/icons/check.svg";

export default function CopyButton({message, cooldown_ms = 700}) {
    // State to manage copy status
    const [copied, setCopied] = useState(false);
    
    // Copy function
    const handleCopy = useCallback(async () => {
        try {
        const textToCopy = message.content[0]?.data;
        await navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setIndexChecked(index);
        } catch (err) {
        console.error("Copy failed:", err);
        }
    }, [message]);

    // Reset "copied" status after cooldown
    useEffect(() => {
        if (copied) {
            const timer = setTimeout(() => setCopied(false), cooldown_ms);
            return () => clearTimeout(timer);
        }
    }, [copied]);

    return (
        <button
            onClick={handleCopy}
            title="Copy message"
            >
            {/* Copy and Check Icon */}
            <img
                src={copied ? icon_check : icon_copy}
                alt="copy"
                 className={`h-[18px] w-[18px] transition-opacity ease-in-out
                    ${copied ? `duration-${cooldown_ms} opacity-0` : `duration-0 opacity-100`}`}
            />
        </button>
    );
}
