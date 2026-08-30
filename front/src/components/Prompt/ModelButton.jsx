import { Fragment } from "react";
import { Popover, PopoverButton, PopoverPanel, Transition } from "@headlessui/react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "@carbon/icons-react";
import DemandIndicator from "../Header/DemandIndicator";
import ModelSelectorWrapper from "../Header/ModelSelectorWrapper";

/**
 * The model picker, as a compact chip in the prompt box.
 *
 * The panel is a Headless UI PopoverPanel with `anchor="top"`, which portals to
 * the body — the prompt box is an overflow container, so anything positioned
 * inside it would be clipped.
 */
export default function ModelButton({ localState, setLocalState, modelsData }) {
  const { t } = useTranslation();
  const selectedModel = localState?.settings?.model;

  return (
    <Popover className="model-selector relative flex min-w-0">
      {/* The chip names the model, so it needs no tooltip of its own — a
          wrapper here would also block it from shrinking beside Send. */}
      <PopoverButton
        title={t("model_selector.change_model")}
        aria-label={t("model_selector.change_model")}
        className="flex justify-between min-w-[12rem] max-w-[12rem] lg:min-w-[17rem] lg:max-w-[17rem] cursor-pointer items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-bg_secondary_dark px-2 py-1 text-sm text-black dark:text-white hover:border-tertiary focus:outline-none transition-colors"
      >
        <span className="flex-shrink-0 flex items-center">
          <DemandIndicator
            demand={selectedModel?.demand}
            status={selectedModel?.status}
          />
        </span>
        <span className="truncate font-medium">{selectedModel?.name}</span>
        <ChevronDown size={16} className="flex-shrink-0 text-tertiary" />
      </PopoverButton>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-150"
        enterFrom="opacity-0 translate-y-1"
        enterTo="opacity-100 translate-y-0"
        leave="transition ease-in duration-100"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 translate-y-1"
      >
        <PopoverPanel
          anchor="top"
          className="z-50 mb-2 w-[26rem] max-w-[90vw] max-h-[70vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-gray-600 bg-white dark:bg-bg_secondary_dark shadow-xl dark:shadow-dark"
        >
          {({ close }) => (
            <ModelSelectorWrapper
              localState={localState}
              setLocalState={setLocalState}
              modelsData={modelsData}
              listOnly
              onSelected={close}
            />
          )}
        </PopoverPanel>
      </Transition>
    </Popover>
  );
}
