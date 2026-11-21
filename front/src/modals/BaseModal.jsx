import { Fragment, useEffect, useRef } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { Trans } from "react-i18next";
import cross_sm from "../assets/icons/cross_sm.svg";

// The app's double-click window. A dialog opened by a click sees the second
// click of that double click land on its own overlay, and Headless UI would
// treat it as "outside" and close the dialog before it is visible.
const OPEN_GRACE_MS = 300;

/**
 * BaseModal Component
 *
 * A reusable modal with Headless UI, TailwindCSS, and i18n.
 *
 * Props:
 * - isOpen (boolean): Modal open state
 * - onClose (function): Function to close the modal
 * - titleKey (string): i18n key for the modal title
 * - children (ReactNode): Modal inner content
 * - maxWidth (string): Tailwind class for max width (default: max-w-md)
 */
export default function BaseModal({
  isOpen,
  onClose,
  titleKey,
  children,
  maxWidth = "max-w-md",
  isForced = false,
  minimal = false,
  titleValues,
  contentClassName = "p-5 pt-0 flex flex-col gap-0",
}) {

  const openedAtRef = useRef(0);
  useEffect(() => {
    if (isOpen) openedAtRef.current = Date.now();
  }, [isOpen]);

  // Only the dialog's own dismissal (overlay, Escape) waits. The close button
  // and the footers' cancel buttons call `onClose` directly.
  const dismiss = () => {
    const openedAt = openedAtRef.current;
    if (!openedAt || Date.now() - openedAt < OPEN_GRACE_MS) return;
    onClose?.();
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-[1000]"
        onClose={isForced ? () => {} : dismiss}
      >
        {/* Overlay */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 backdrop-blur-sm bg-black/5" />
        </Transition.Child>

        {/* Centered Modal */}
        <div className="fixed z-[999] inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel
                className={`rounded-box bg-base-100 text-base-content w-full ${maxWidth} shadow-lg`}
              >
                {/* Header */}
                <div className="flex justify-between items-center p-5 pb-3">
                  <Dialog.Title className="font-semibold text-sm text-accent">
                    <Trans i18nKey={titleKey} values={titleValues} />
                  </Dialog.Title>

                  {/* Close button */}
                  {!minimal && !isForced && (
                  <button
                    onClick={onClose}
                    className="btn btn-ghost btn-sm btn-square"
                    aria-label="Close dialog"
                  >
                    <img
                      src={cross_sm}
                      alt="Close"
                      className="h-[24px] w-[24px]"
                    />
                  </button>
                  )}
                </div>

                {/* Content */}
                <div className={contentClassName}>{children}</div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
