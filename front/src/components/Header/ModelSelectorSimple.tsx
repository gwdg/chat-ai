
import {
  faBookOpen,
  faBrain,
  faCircleInfo,
  faChevronDown,
  faFilter,
  faImage,
  faMagnifyingGlass,
  faMicrophone,
  faVideo
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { BaseModelInfo } from "../../types/models";
import Tooltip from "../Others/Tooltip";
import DemandIndicator from "./DemandIndicator";

const isExternalModel = (model: { name?: string } | undefined) =>
  typeof model?.name === "string" && model.name.toLowerCase().includes("external");

const scopeOptions = [
  { value: "all", labelKey: "model_selector.scope_all" },
  { value: "internal", labelKey: "model_selector.scope_internal" },
  { value: "external", labelKey: "model_selector.scope_external" },
];

export default function ModelSelectorSimple({ selectedModel, modelsData, onChange, inHeader = false, listOnly = false, onSelected }: { selectedModel: BaseModelInfo | null, modelsData: BaseModelInfo[], inHeader: boolean, onChange: (model: BaseModelInfo) => void, listOnly?: boolean, onSelected?: () => void }) {
  
  const { t } = useTranslation();

  function setSelectedModel(model: BaseModelInfo | null) {
    onChange && onChange(model);
  }

  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [modelScope, setModelScope] = useState("all"); // all, internal, external

  // Dropdown close on click outside logic
  const dropdownRef = useRef(null);
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false); // close dropdown
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const filteredModelsList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (modelsData === undefined || modelsData.length === 0) {
      return [];
    }
    let result = modelsData.slice(); // copy list
    if (q && q !== "") {
      result = modelsData.filter((m) =>
        m.name.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        m.input.some(input => input.toLowerCase().includes(q)) ||
        m.output.some(output => output.toLowerCase().includes(q))
      );
    }

    if (modelScope !== "all") {
      const wantExternal = modelScope === "external";
      result = result.filter((m) => isExternalModel(m) === wantExternal);
    }

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [searchQuery, modelsData, modelScope]);

  // Nothing to choose between when a deployment offers only one kind of model.
  const showScopeFilter = useMemo(() => {
    if (!modelsData || modelsData.length === 0) return false;
    return modelsData.some(isExternalModel) && modelsData.some((m) => !isExternalModel(m));
  }, [modelsData]);

  // use memo to not rerender on search input
  const ListElement = memo(({ idx, model, selected, onClick }: { idx: number, model: BaseModelInfo, selected: boolean, onClick: () => void }) => {
    return (
      <div
        onClick={onClick}
        data-index={idx} data-id={model.id} tabIndex={idx}
        className={`item cursor-pointer my-1 px-2 py-1 hover:bg-slate-100 rounded-2xl border bg-white dark:bg-bg_secondary_dark ${selected ? "border-blue-500" : "border-slate-200 dark:border-gray-500"}`}
      >
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="pl-1 shrink-0">
              <DemandIndicator demand={model.demand} status={model?.status} />
            </div>
            <span className="font-medium truncate">{model.name}</span>
          </div>
          <div className="ml-2 flex shrink-0 items-center gap-1 text-tertiary">
            {model.input?.includes("image") && <Tooltip text={"Image Input"}><FontAwesomeIcon icon={faImage} /></Tooltip>}
            {model.input?.includes("video") && <Tooltip text={"Video Input"}><FontAwesomeIcon icon={faVideo} /></Tooltip>}
            {model.input?.includes("audio") && <Tooltip text={"Audio Input"}><FontAwesomeIcon icon={faMicrophone} /></Tooltip>}
            {model.input?.includes("arcana") && <Tooltip text={"Arcana Input"}><FontAwesomeIcon icon={faBookOpen} /></Tooltip>}
            {model.output?.includes("thought") && <Tooltip text={"Thinking"}><FontAwesomeIcon icon={faBrain} /></Tooltip>}
          </div>
        </div>
      </div>
    );
  });

  return (

    <div ref={dropdownRef} className={`w-full relative dark:text-white ${listOnly ? "flex min-h-0 flex-1 flex-col" : ""}`}>
      {/** Trigger/Input — suppressed when the caller supplies its own **/}
      {!listOnly && (
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className={`border border-gray-200 dark:border-bg_secondary_dark
                  ${!inHeader && "shadow-md shadow-sm"}  
                  w-full text-center desktop:w-full rounded-xl bg-white dark:bg-bg_secondary_dark
                  px-1 py-2.5 lg:px-3
                  hover:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30`}>
        <div id="trigger-content" className="flex justify-between">
          {/* Left section - allow to shrink */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="pl-2">
              <DemandIndicator demand={selectedModel?.demand} status={selectedModel?.status} />
            </div>
            <span className="font-medium truncate">{selectedModel?.name}</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="ml-2 flex items-center gap-1 text-tertiary">
              {selectedModel?.input?.includes("image") && <Tooltip text={"Image Input"} placement="bottom"><FontAwesomeIcon icon={faImage} /></Tooltip>}
              {selectedModel?.input?.includes("video") && <Tooltip text={"Video Input"} placement="bottom"><FontAwesomeIcon icon={faVideo} /></Tooltip>}
              {selectedModel?.input?.includes("audio") && <Tooltip text={"Audio Input"} placement="bottom"><FontAwesomeIcon icon={faMicrophone} /></Tooltip>}
              {selectedModel?.input?.includes("arcana") && <Tooltip text={"Arcana Input"} placement="bottom"><FontAwesomeIcon icon={faBookOpen} /></Tooltip>}
              {selectedModel?.output?.includes("thought") && <Tooltip text={"Thinking"} placement="bottom"><FontAwesomeIcon icon={faBrain} /></Tooltip>}

            </div>
            <FontAwesomeIcon icon={faChevronDown} />
          </div>
        </div>

      </button>
      )}


      {/** Dropdown Panel — rendered inline when there is no trigger **/}
      <div className={listOnly
        ? "bg-white dark:bg-bg_secondary_dark w-full rounded-2xl pb-2 flex min-h-0 flex-1 flex-col"
        : `${dropdownOpen ? "" : "hidden"} ${inHeader ? "fixed left-0 top-12 w-screen" : "absolute"} flex flex-col max-h-[80dvh] bg-white dark:bg-bg_secondary_dark z-50 mt-1 w-full rounded-2xl border border-slate-200 dark:border-gray-500  shadow-2xl dark:shadow-dark pb-4`}>

        <div className="px-3 pt-3 pb-2 shrink-0">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-600 dark:text-slate-200">
            <FontAwesomeIcon icon={faCircleInfo} className="text-tertiary" />
            <span>
              {t("model_selector.docs_hint_text")}{" "}
              <a
                className="text-tertiary underline font-medium"
                href="https://docs.hpc.gwdg.de/services/chat-ai/models/index.html"
                target="_blank"
                rel="noreferrer noopener"
              >
                {t("model_selector.docs_hint_link")}
              </a>
            </span>
          </div>
        </div>
        {/** Controls **/}
        <div className={`text-sm flex items-center gap-2 p-2 border-b border-slate-100 dark:border-gray-500 shrink-0`}>
          <div className="relative flex-1 min-w-0">
            <FontAwesomeIcon icon={faMagnifyingGlass} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              type="text" placeholder="Search models…" autoComplete="off" className="w-full rounded-xl border border-slate-200 dark:border-gray-500 pl-9 pr-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30" />
          </div>

          {/** Internal / external scope filter **/}
          {showScopeFilter && (
            <Menu as="div" className="relative inline-block shrink-0 text-left">

              <MenuButton className="inline-flex w-full justify-between items-center rounded-xl border border-slate-200 bg-white dark:bg-bg_secondary_dark px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-200 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/40" title={t("model_selector.scope_filter")}>
                <span className="hidden sm:block">
                  {t(scopeOptions.find((opt) => opt.value === modelScope)?.labelKey)}
                  <FontAwesomeIcon size="sm" icon={faChevronDown} className="ml-1" />
                </span>
                <span className="sm:hidden">
                  <FontAwesomeIcon icon={faFilter} />
                </span>
              </MenuButton>

              <MenuItems className="absolute right-0 mt-2 w-40 origin-top-right rounded-xl bg-white dark:bg-bg_secondary_dark shadow-lg ring-1 ring-black/5 focus:outline-none z-50">
                <div className="py-1">
                  {scopeOptions.map((option) => (
                    <MenuItem key={option.value}>
                      {({ close }) => (
                        <button
                          onClick={() => { setModelScope(option.value); close() }}
                          className={`data-focus:bg-indigo-50 dark:data-focus:bg-secondary rounded-xl block w-full px-4 py-2 text-left text-sm ${
                            modelScope === option.value
                              ? "text-tertiary font-medium"
                              : "text-slate-700 dark:text-slate-200"
                          }`}
                        >
                          {t(option.labelKey)}
                        </button>
                      )}
                    </MenuItem>
                  ))}
                </div>
              </MenuItems>
            </Menu>
          )}
        </div>

        {/** Results List **/}
        <div
          id="model-listbox" role="listbox" aria-label="Models" tabIndex={-1}
          className="px-2 flex-1 min-h-0 overflow-auto"
        >
          <div className="rounded-xl overflow-hidden">
            {filteredModelsList.map((m, idx) => (
              <ListElement
                key={m.id}
                onClick={() => { setSelectedModel(m); setDropdownOpen(false); onSelected?.(); }}
                idx={idx} model={m} selected={selectedModel?.id === m.id} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
