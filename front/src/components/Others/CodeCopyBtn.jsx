import { useState, useEffect } from "react";
import { Copy, Check } from "lucide-react";

export default function CodeCopyBtn({ children, hovered }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let timer;
    if (copied) {
      timer = setTimeout(() => {
        setCopied(false);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [copied]);

  // Helper function to recursively extract text from React nodes
  function extractTextFromReactNode(node) {
    if (node == null) return "";
    if (typeof node === "string") return node;
    if (typeof node === "number") return String(node);
    if (Array.isArray(node)) {
      return node.map(extractTextFromReactNode).join("");
    }
    if (node.props && node.props.children) {
      return extractTextFromReactNode(node.props.children);
    }
    return "";
  }

  return (
    <div
      className={`${
        hovered ? "opacity-100 " : "opacity-0"
      } flex items-center transition-opacity duration-300`}
    >
      {copied ? (
        <Check className="h-[15px] w-[15px] text-green-500" alt="copy" />
      ) : (
        <Copy
          className="h-[15px] w-[15px] cursor-pointer text-[#009EE0]"
          alt="copy"
          onClick={() => {
            const textToCopy = extractTextFromReactNode(children);
            navigator.clipboard.writeText(textToCopy).catch(() => {});
            setCopied(true);
          }}
        />
      )}
    </div>
  );
}
