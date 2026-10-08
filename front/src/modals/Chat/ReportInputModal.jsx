import { useLayoutEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Microphone } from "@carbon/icons-react";
import BaseModal from "../BaseModal";
import Tooltip from "../../components/Others/Tooltip";
import { useDictation } from "../../hooks/useDictation";

// A space between dictated text and its neighbours, only where two words
// would otherwise run together.
const needsSpace = (left, right) =>
  left !== "" && right !== "" && !/\s$/.test(left) && !/^\s/.test(right);

const formatDuration = (seconds) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

// Large paste area for one radiology input (previous report, dictation or
// assessment). The text is passed on exactly as entered or dictated.
export default function ReportInputModal({
  isOpen,
  onClose,
  kind,
  initialText = "",
  onConfirm,
}) {
  const { t } = useTranslation();
  const [text, setText] = useState(initialText);
  const textareaRef = useRef(null);
  const cursorRef = useRef(initialText.length);

  // Dictated text goes where the cursor is, replacing any selection
  const insertAtCursor = (transcript) => {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? text.length;
    const end = textarea?.selectionEnd ?? text.length;
    const before = text.slice(0, start);
    const after = text.slice(end);
    const inserted =
      (needsSpace(before, transcript) ? " " : "") +
      transcript +
      (needsSpace(transcript, after) ? " " : "");
    cursorRef.current = before.length + inserted.length;
    setText(before + inserted + after);
  };
  const dictation = useDictation(insertAtCursor);
  const busy = dictation.status !== "idle";
  const dictationLabel = {
    idle: t("radiology.dictate"),
    recording: t("radiology.dictate_stop"),
    transcribing: t("radiology.transcribing"),
  }[dictation.status];
  const isEmpty = text.trim() === "";

  // Place the cursor at the end on open, and behind newly dictated text
  useLayoutEffect(() => {
    if (cursorRef.current === null) return;
    textareaRef.current?.focus();
    textareaRef.current?.setSelectionRange(cursorRef.current, cursorRef.current);
    cursorRef.current = null;
  }, [text]);

  const handleConfirm = () => {
    if (isEmpty || busy) return;
    onConfirm(text);
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey={`radiology.modal_title.${kind}`}
      maxWidth="max-w-4xl"
      // Escape or a click outside must not throw away a running dictation
      isForced={busy}
    >
      <div className="flex flex-col gap-3">
        <textarea
          ref={textareaRef}
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              handleConfirm();
            }
          }}
          spellCheck={false}
          placeholder={t("radiology.paste_placeholder")}
          className="w-full h-[60vh] p-3 text-sm font-sans resize-none border dark:border-border_dark rounded-lg
                   bg-white dark:bg-black text-black dark:text-white
                   focus:outline-none focus:ring-2 focus:ring-tertiary"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400">
          <Trans i18nKey="radiology.verbatim_hint" />
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-2">
            <Tooltip text={dictationLabel}>
              <button
                type="button"
                aria-label={dictationLabel}
                className={`h-10 w-10 rounded-full flex items-center justify-center
                         cursor-pointer transition-colors disabled:cursor-wait ${
                           dictation.status === "recording"
                             ? "bg-red-500 hover:bg-red-600 animate-pulse"
                             : "bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
                         }`}
                onClick={
                  dictation.status === "recording"
                    ? dictation.stop
                    : dictation.start
                }
                disabled={dictation.status === "transcribing"}
              >
                {dictation.status === "idle" && (
                  <Microphone size={20} className="text-tertiary" />
                )}
                {dictation.status === "recording" && (
                  <span className="w-3 h-3 bg-white rounded-sm" />
                )}
                {dictation.status === "transcribing" && (
                  <span className="w-4 h-4 border-2 border-tertiary border-t-transparent rounded-full animate-spin" />
                )}
              </button>
            </Tooltip>
            {dictation.status === "recording" && (
              <span className="text-sm tabular-nums text-gray-500 dark:text-gray-400">
                {formatDuration(dictation.seconds)}
              </span>
            )}
          </div>
          <div className="flex gap-3 ml-auto">
            <button
              className="cursor-pointer p-3 border dark:border-border_dark rounded-2xl
                       text-black dark:text-white bg-gray-100 dark:bg-gray-800
                       hover:bg-gray-200 dark:hover:bg-gray-700
                       min-w-[100px] select-none"
              onClick={onClose}
            >
              {t("common.cancel")}
            </button>
            <button
              className="cursor-pointer p-3 bg-tertiary text-white rounded-2xl
                       hover:bg-tertiary/90 min-w-[100px]
                       select-none shadow-lg dark:shadow-dark
                       disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={isEmpty || busy}
              onClick={handleConfirm}
            >
              {t("common.ok")}
            </button>
          </div>
        </div>
      </div>
    </BaseModal>
  );
}
