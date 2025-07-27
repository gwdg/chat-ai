// Importing necessary assets and hooks from React
import { useState, useEffect } from "react";
import copy from "../../assets/icon_copy.svg";
import check from "../../assets/check.svg";

// CodeCopyBtn component definition
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
    if (typeof node === "string") {
      return node;
    }
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
      } flex justify-end items-center absolute top-2 right-2 transition-opacity duration-300`}
    >
      {copied ? (
        <img src={check} alt="copy" className="h-[15px] w-[15px]" />
      ) : (
        <img
          src={copy}
          alt="copy"
          className="h-[15px] w-[15px] cursor-pointer"
          onClick={() => {
            const textToCopy = extractTextFromReactNode(children);
            navigator.clipboard.writeText(textToCopy);
            setCopied(true);
          }}
        />
      )}
    </div>
  );
}
