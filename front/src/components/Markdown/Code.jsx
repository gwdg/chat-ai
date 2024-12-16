import { memo } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

const Code = memo(({ language, children }) => {
  return (
    <div className="relative block bg-neutral-800 rounded-lg p-1 my-4">
      <SyntaxHighlighter
        style={vscDarkPlus}
        className="custom-syntax-highlighter !bg-transparent"
        language={language || "text"}
        PreTag="div"
        wrapLines={true}
        wrapLongLines={true}
      >
        {String(children).replace(/\n$/, "")}
      </SyntaxHighlighter>
    </div>
  );
});

Code.displayName = "Code";

export default Code;
