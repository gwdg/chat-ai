import { useState, useCallback, useEffect } from "react";

import { Copy, Check, CopyCheck } from "lucide-react";

export default function CopyButton({ message, cooldown_ms = 700 }) {
  // State to manage copy status
  const [copied, setCopied] = useState(false);

  // Copy function
  const handleCopy = useCallback(async () => {
    try {
      const textToCopy = message.content[0]?.text;
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
    <button onClick={handleCopy} title="Copy message" className="inline-grid h-[22px] w-[22px] cursor-pointer">
        {/* Copy: always instant */}
        <Copy
          className={`row-start-1 col-start-1 h-[22px] w-[22px] text-[#009EE0] transition-opacity ${copied ? 'opacity-0 duration-0' : 'opacity-100 duration-0'}`}
          aria-hidden={copied}
        />
        {/* CopyCheck: instant enter, timed leave; stacked above Copy */}
        <CopyCheck
          className={`row-start-1 col-start-1 h-[22px] w-[22px] text-green-500 transition-opacity ease-in-out ${copied ? 'opacity-100 duration-0 z-10' : 'opacity-0'}`}
          style={!copied ? { transitionDuration: `${cooldown_ms}ms` } : undefined}
          aria-hidden={!copied}
        />
      
    </button>
  );
}
