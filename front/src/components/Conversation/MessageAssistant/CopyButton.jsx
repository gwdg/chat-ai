import { useState, useCallback, useEffect } from "react";

import { Copy, Check } from "lucide-react";

export default function CopyButton({ message, cooldown_ms = 700 }) {
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
      className="cursor-pointer"
    >
      {/* Copy and Check Icon */}
      {copied ? (
        <Check
          className={`h-[18px] w-[18px] text-green-500 transition-opacity ease-in-out duration-${cooldown_ms} opacity-0`}
          alt="copied"
        />
      ) : (
        <Copy
          className="h-[18px] w-[18px] text-[#009EE0] transition-opacity ease-in-out duration-0 opacity-100"
          alt="copy"
        />
      )}
    </button>
  );
}
