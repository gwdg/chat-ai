import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp } from "@carbon/icons-react";
import { getInputLabels } from "../../../utils/radiologyPrompt";

// User message assembled from radiology inputs: lists which inputs went in and
// shows the exact prompt sent to the model on demand.
export default function RadiologyMessageText({ message }) {
  const { t } = useTranslation();
  const [showPrompt, setShowPrompt] = useState(false);
  const labels = getInputLabels(message.meta.radiology.parts || [], t);

  return (
    <div className="flex flex-col gap-2 flex-grow min-w-0 text-sm">
      <div className="flex flex-wrap gap-1.5">
        {labels.map((label, i) => (
          <span
            key={i}
            className="px-2 py-0.5 rounded-full text-xs font-medium
                     bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
          >
            {label}
          </span>
        ))}
      </div>
      <button
        className="flex items-center gap-1 text-xs text-tertiary w-fit cursor-pointer"
        onClick={() => setShowPrompt((show) => !show)}
      >
        {showPrompt ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        {t(showPrompt ? "radiology.hide_prompt" : "radiology.show_prompt")}
      </button>
      {showPrompt && (
        <pre
          className="font-sans text-sm max-h-[60vh] overflow-y-auto"
          style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
        >
          {message.content[0]?.text}
        </pre>
      )}
    </div>
  );
}
