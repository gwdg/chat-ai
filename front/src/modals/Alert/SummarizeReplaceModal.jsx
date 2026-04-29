import { Trans } from "react-i18next";
import BaseModal from "../BaseModal";

/**
 * status: "confirm" | "loading" | "success" | "error"
 * onConfirm: called when user clicks Summarize
 * onClose: called to close the modal
 * errorMessage: optional error string when status === "error"
 */
export default function SummarizeReplaceModal({
  isOpen,
  onClose,
  onConfirm,
  status = "confirm",
  errorMessage,
}) {
  const isLoading = status === "loading";

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={isLoading ? () => {} : onClose}
      titleKey="common.summarize"
      maxWidth="max-w-md"
      isForced={isLoading}
    >
      {/* Confirm state */}
      {status === "confirm" && (
        <>
          <div className="pt-0 pb-2">
            <p className="dark:text-white text-black text-justify text-sm">
              <Trans i18nKey="alert.summarize_replace" />
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-2 justify-between w-full text-sm">
            <button
              type="button"
              className="cursor-pointer px-5 py-3 rounded-lg font-medium
                        text-gray-700 bg-gray-200 border border-gray-300
                        hover:bg-gray-300 hover:border-gray-400
                        active:scale-95 transition-all duration-200
                        dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600
                        dark:hover:bg-gray-600"
              onClick={onClose}
            >
              <Trans i18nKey="common.cancel" />
            </button>

            <button
              type="button"
              className="cursor-pointer px-5 py-3 rounded-lg font-medium
                        text-white bg-red-600 border border-red-700
                        hover:bg-red-700 hover:border-red-800
                        active:scale-95 transition-all duration-200 shadow-md
                        dark:shadow-black/30"
              onClick={() => {
                if (typeof onConfirm === "function") {
                  onConfirm();
                }
              }}
            >
              <Trans i18nKey="common.summarize" />
            </button>
          </div>
        </>
      )}

      {/* Loading state */}
      {status === "loading" && (
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-gray-300 dark:border-gray-600 border-t-[#009EE0]" />
          <p className="dark:text-white text-black text-sm font-medium">
            <Trans i18nKey="common.summarizing" />
          </p>
          <p className="dark:text-gray-400 text-gray-500 text-xs text-center">
            <Trans i18nKey="alert.summarize_in_progress" />
          </p>
        </div>
      )}

      {/* Success state */}
      {status === "success" && (
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30">
            <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="dark:text-white text-black text-sm font-medium">
            <Trans i18nKey="common.summarize_success" />
          </p>
        </div>
      )}

      {/* Error state */}
      {status === "error" && (
        <>
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30">
              <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="dark:text-white text-black text-sm font-medium">
              <Trans i18nKey="common.summarize_error" />
            </p>
            {errorMessage && (
              <p className="dark:text-gray-400 text-gray-500 text-xs text-center max-w-full break-words">
                {errorMessage}
              </p>
            )}
          </div>

          <div className="flex justify-center w-full text-sm">
            <button
              type="button"
              className="cursor-pointer px-5 py-3 rounded-lg font-medium
                        text-gray-700 bg-gray-200 border border-gray-300
                        hover:bg-gray-300 hover:border-gray-400
                        active:scale-95 transition-all duration-200
                        dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600
                        dark:hover:bg-gray-600"
              onClick={onClose}
            >
              <Trans i18nKey="common.close" />
            </button>
          </div>
        </>
      )}
    </BaseModal>
  );
}
