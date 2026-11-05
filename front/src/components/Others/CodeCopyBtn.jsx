import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Check, Download } from "lucide-react";

const EXTENSION_BY_LANGUAGE = {
  python: "py",
  py: "py",
  javascript: "js",
  js: "js",
  typescript: "ts",
  ts: "ts",
  jsx: "jsx",
  tsx: "tsx",
  json: "json",
  html: "html",
  css: "css",
  scss: "scss",
  sass: "sass",
  less: "less",
  bash: "sh",
  sh: "sh",
  shell: "sh",
  zsh: "sh",
  yaml: "yml",
  yml: "yml",
  xml: "xml",
  sql: "sql",
  java: "java",
  c: "c",
  cpp: "cpp",
  "c++": "cpp",
  csharp: "cs",
  cs: "cs",
  go: "go",
  rust: "rs",
  rs: "rs",
  ruby: "rb",
  php: "php",
  swift: "swift",
  kotlin: "kt",
  r: "r",
  matlab: "m",
  tex: "tex",
  latex: "tex",
  markdown: "md",
  md: "md",
};

const extensionFor = (language) =>
  EXTENSION_BY_LANGUAGE[String(language || "").toLowerCase()] || "txt";

const fileNameFor = (language) => {
  const stamp = new Date()
    .toISOString()
    .replace(/[:T]/g, "-")
    .slice(0, 19);
  return `code-${stamp}.${extensionFor(language)}`;
};

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

export default function CodeCopyBtn({ children, hovered, language }) {
  const { t } = useTranslation();
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

  const text = extractTextFromReactNode(children);

  const handleDownload = () => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileNameFor(language);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <div
      className={`${
        hovered ? "opacity-100 " : "opacity-0"
      } flex items-center gap-1.5 transition-opacity duration-300`}
    >
      <Download
        className="h-[15px] w-[15px] cursor-pointer text-accent"
        aria-label={t("file_preview.download_aria")}
        title={t("file_preview.download_aria")}
        onClick={handleDownload}
      />
      {copied ? (
        <Check className="h-[15px] w-[15px] text-success" alt="copy" />
      ) : (
        <Copy
          className="h-[15px] w-[15px] cursor-pointer text-accent"
          alt="copy"
          onClick={() => {
            navigator.clipboard.writeText(text);
            setCopied(true);
          }}
        />
      )}
    </div>
  );
}
