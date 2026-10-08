import { useTranslation } from "react-i18next";
import { Add, Close } from "@carbon/icons-react";
import { useModal } from "../../modals/ModalContext";
import {
  REPORT_KINDS,
  getInputLabels,
  insertInput,
} from "../../utils/radiologyPrompt";

// Buttons and chips for the radiology inputs (modules.radiology). Each input is
// pasted into its own window, so the radiologist never has to mark up which
// text is which.
export default function ReportInputs({ inputs, setInputs }) {
  const { t } = useTranslation();
  const { openModal } = useModal();
  const labels = getInputLabels(inputs.map((input) => input.kind), t);

  const editInput = (index) =>
    openModal("reportInput", {
      kind: inputs[index].kind,
      initialText: inputs[index].text,
      onConfirm: (text) =>
        setInputs((prev) =>
          prev.map((input, i) => (i === index ? { ...input, text } : input))
        ),
    });

  const addInput = (kind) =>
    openModal("reportInput", {
      kind,
      onConfirm: (text) => setInputs((prev) => insertInput(prev, { kind, text })),
    });

  const removeInput = (index) =>
    setInputs((prev) => prev.filter((_, i) => i !== index));

  // Dictation and assessment exist at most once; edit them through their chip.
  const addableKinds = Object.keys(REPORT_KINDS).filter(
    (kind) =>
      REPORT_KINDS[kind].multiple ||
      !inputs.some((input) => input.kind === kind)
  );

  return (
    <div className="select-none flex flex-wrap items-center gap-2 px-2 py-2">
      {inputs.map((input, index) => (
        <div
          key={index}
          className="flex items-center gap-2 max-w-[260px] pl-3 pr-1 py-1.5 rounded-lg cursor-pointer
                   border border-blue-200 dark:border-blue-700/50
                   bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-800/30"
          title={t("radiology.edit")}
          onClick={() => editInput(index)}
        >
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-900 dark:text-white">
              {labels[index]}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
              {input.text.split("\n").find((line) => line.trim() !== "")}
            </p>
          </div>
          <button
            className="p-1 rounded-full flex-shrink-0 hover:bg-white/90 dark:hover:bg-black/70"
            onClick={(e) => {
              e.stopPropagation();
              removeInput(index);
            }}
            aria-label={t("radiology.remove")}
          >
            <Close size={16} className="opacity-70 hover:opacity-100" />
          </button>
        </div>
      ))}
      {addableKinds.map((kind) => (
        <button
          key={kind}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium
                   border border-dashed border-gray-300 dark:border-gray-600
                   text-tertiary hover:bg-gray-100 dark:hover:bg-gray-800"
          onClick={() => addInput(kind)}
        >
          <Add size={16} />
          {t(`radiology.${kind}`)}
        </button>
      ))}
    </div>
  );
}
