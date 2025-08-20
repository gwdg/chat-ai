import { Fragment } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { Trans } from "react-i18next";
import cross_sm from "../assets/icons/cross_sm.svg";

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
  isForced = false
}) {
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-[1000]"
        onClose={isForced ? () => {} : onClose}
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
          <div className="fixed inset-0 backdrop-blur-sm bg-black/30 dark:bg-black/50" />
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
                className={`select-none rounded-2xl bg-white dark:bg-black w-full ${maxWidth} shadow-lg`}
              >
                {/* Header */}
                <div className="flex justify-between items-center px-4 pt-4">
                  <Dialog.Title className="text-sm text-tertiary">
                    <Trans i18nKey={titleKey} />
                  </Dialog.Title>

                  {/* Close button */}
                  <button
                    onClick={onClose}
                    className="cursor-pointer p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 transition"
                    aria-label="Close dialog"
                  >
                    <img
                      src={cross_sm}
                      alt="Close"
                      className="h-[24px] w-[24px]"
                    />
                  </button>
                </div>

                {/* Content */}
                <div className="p-4 pt-0 flex flex-col gap-0">{children}</div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}