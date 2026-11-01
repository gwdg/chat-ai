import { useState, useCallback, useEffect } from "react";

import { Copy, CopyCheck } from "lucide-react";
import { stripThinking } from "../../../utils/thinking";

export default function CopyButton({
  message,
  text,
  title = "Copy message",
  cooldown_ms = 700,
}) {
  // State to manage copy status
  const [copied, setCopied] = useState(false);

  // Copy function
  const handleCopy = useCallback(async () => {
    try {
      const textToCopy =
        text ?? stripThinking(message?.content?.[0]?.text ?? "");
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  }, [message, text]);

  // Reset "copied" status after cooldown
  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), cooldown_ms);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  return (
    <button onClick={handleCopy} title={title} className="inline-grid h-[18px] w-[18px] cursor-pointer">
        {/* Copy: always instant */}
        <Copy
          className={`row-start-1 col-start-1 h-[18px] w-[18px] text-[#009EE0] transition-opacity ${copied ? 'opacity-0 duration-0' : 'opacity-100 duration-0'}`}
          aria-hidden={copied}
        />
        {/* CopyCheck: instant enter, timed leave; stacked above Copy */}
        <CopyCheck
          className={`row-start-1 col-start-1 h-[18px] w-[18px] text-green-500 transition-opacity ease-in-out ${copied ? 'opacity-100 duration-0 z-10' : 'opacity-0'}`}
          style={!copied ? { transitionDuration: `${cooldown_ms}ms` } : undefined}
          aria-hidden={!copied}
        />
      
    </button>
  );
}
