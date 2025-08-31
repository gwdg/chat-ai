
import { useState, useMemo, useEffect, useRef, memo, use } from "react";
import Tooltip from "../Others/Tooltip";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useSelector } from "react-redux";
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'

import {
  faChevronDown, faList, faTableCells, faMagnifyingGlass, faBrain,
  faImage, faVideo, faCircleDot, faLayerGroup, faFilter,
  faHashtag, faTriangleExclamation,
  faShield,
  faShieldHalved,
  faMicrophone
} from '@fortawesome/free-solid-svg-icons'

import { faCalendar, faRectangleList } from '@fortawesome/free-regular-svg-icons'

import DemandIndicator from "./DemandIndicator";

import type { ExtendedModelInfo } from "../../types/models";

import {
  faArrowUpAZ
} from "@fortawesome/free-solid-svg-icons";
import { selectDefaultModel } from "../../Redux/reducers/userSettingsReducer";
const sortOptions = [
  { value: "name-asc", label: "Name (A→Z)" },
  { value: "name-desc", label: "Name (Z→A)" },
  { value: "date-desc", label: "Release (new→old)" },
  { value: "date-asc", label: "Release (old→new)" },
  { value: "params-desc", label: "Params (high→low)" },
  { value: "params-asc", label: "Params (low→high)" },
  { value: "context-desc", label: "Context (high→low)" },
  { value: "context-asc", label: "Context (low→high)" },
];

export default function ModelSelectorSimple({ currentModelId, modelsData, onChange }: { currentModelId: string | undefined, modelsData: ExtendedModelInfo[], onChange?: (model: ExtendedModelInfo) => void }) {

  const defaultModel = useSelector(selectDefaultModel); // load from redis

  // choose model of conversation, or default model or first model in list
  const selectedModel = modelsData ? modelsData.find(model => model.id === currentModelId) || modelsData.find(model => model.id === defaultModel) || modelsData[0] || null : null;

  //this catches the case that the current model is not in the list or is invalid
  useEffect(() => {
    if(currentModelId === undefined || currentModelId !== selectedModel?.id){
      setSelectedModel(selectedModel);
    }
  }, []);

  function setSelectedModel(model: ExtendedModelInfo | null) {
    onChange?.(model);
  }

  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [resultViewMode, setResultViewMode] = useState("list"); // list, expanded, grid
  const [sortBy, setSortBy] = useState("name-asc"); // name-asc, name-desc, date-asc, date-desc, params-asc, params-desc

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
    const digitsOnly = str => parseFloat(str ? str.replace(/\D/g, "") : 0);
    // Apply sorting based on sortOption
    switch (sortBy) {
      case "name-asc":
        result = result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "name-desc":
        result = result.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case "date-asc":
        result = result.sort((a, b) => Date.parse(a.releaseDate) - Date.parse(b.releaseDate));
        break;
      case "date-desc":
        result = result.sort((a, b) => Date.parse(b.releaseDate) - Date.parse(a.releaseDate));
        break;
      case "params-asc":
        result = result.sort((a, b) => digitsOnly(a.numParameters) - digitsOnly(b.numParameters));
        break;
      case "params-desc":
        result = result.sort((a, b) => digitsOnly(b.numParameters) - digitsOnly(a.numParameters));
        break;
      case "context-asc":
        result = result.sort((a, b) => digitsOnly(a.contextLength) - digitsOnly(b.contextLength));
        break;
      case "context-desc":
        result = result.sort((a, b) => digitsOnly(b.contextLength) - digitsOnly(a.contextLength));
        break;
    }
    return result;
  }, [searchQuery, modelsData, sortBy]);

  const SecureIndicator = memo(({ external }: { external: boolean }) => {
    return (
      <>
        {external == true ? (
          <Tooltip text={"External Model"}>
            <FontAwesomeIcon icon={faTriangleExclamation} className="text-amber-600" />
          </Tooltip>

        ) : (
          <Tooltip text={"Internal Model"}>
            <FontAwesomeIcon icon={faShieldHalved} className="text-green-700" />
          </Tooltip>
        )}
      </>
    );
  });

  const Chip = memo(({ text, colorPreset }: { text: string | undefined, colorPreset?: string }) => {
    let color = "bg-tertiary/20 dark:bg-indigo-600 text-indigo-700 dark:text-white border border-indigo-100 dark:border-indigo-600 text-xs font-medium"
    switch (colorPreset) {
      case "orange":
        color = "bg-amber-100 dark:bg-amber-600 text-amber-700 dark:text-white border-amber-100 dark:border-amber-600 text-xs font-medium";
        break;
      case "green":
        color = "bg-green-100 dark:bg-green-600 text-green-700 dark:text-white border-green-100 dark:border-green-600 text-xs font-medium";
        break;
    }
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full ${color}`}>
        {/** If text is empty, show a dash "-" **/}
        {text && text !== "" ? text : "-"}
      </span>
    );
  });

  // use memo to not rerender on search input
  const ListElement = memo(({ idx, model, onClick }: { idx: number, model: ExtendedModelInfo, onClick: () => void }) => {
    return (
      <div
        onClick={onClick}
        tabIndex={idx} data-index={idx} data-id={model.id}
        className="item cursor-pointer px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-2xl border border-slate-200 dark:border-gray-500"
      >
        <div className="flex justify-between md:flex-row flex-col ">
          <div className="flex items-center md:gap-2 gap-1">
            <div className="pl-1">
              <DemandIndicator demand={model.demand} status={model?.status} />
            </div>
            <span className="font-medium">{model.name}</span>
            <SecureIndicator external={model.external} />
            <Chip text={model.company} />

          </div>
          <div className="grid grid-cols-[6rem_6rem_4.5rem] items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-300">
              <FontAwesomeIcon icon={faCalendar} className="mr-1" />
              {model.releaseDate && model.releaseDate !== "" ? model.releaseDate : "-"}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-300">
              <FontAwesomeIcon icon={faCircleDot} className="mr-1" />
              Context {model.contextLength && model.contextLength !== "" ? model.contextLength : "-"}
            </span>
            {/*
            <span className="text-xs text-slate-500">
              <FontAwesomeIcon icon={faHashtag} className="mr-1" />
              Param {model.numParameters && model.numParameters !== "" ? model.numParameters : "-"}
            </span>*/}
            <div className="flex items-center gap-1 text-tertiary">
              {model.input.includes("image") && <Tooltip text={"Image Input"}><FontAwesomeIcon icon={faImage} /></Tooltip>}
              {model.input.includes("video") && <Tooltip text={"Video Input"}><FontAwesomeIcon icon={faVideo} /></Tooltip>}
              {model.input.includes("audio") && <Tooltip text={"Audio Input"}><FontAwesomeIcon icon={faMicrophone} /></Tooltip>}
              {model.output.includes("thought") && <Tooltip text={"Thinking"}><FontAwesomeIcon icon={faBrain} /></Tooltip>}
              
            </div>
          </div>
        </div>
      </div>
    );
  });

  const ExtendedListElement = memo(({ idx, model, onClick }: { idx: number, model: ExtendedModelInfo, onClick: () => void }) => {
    return (
      <div
        onClick={onClick}
        tabIndex={idx} data-index={idx} data-id={model.id}
        className="item cursor-pointer px-4 py-3 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-2xl border border-slate-200 dark:border-gray-500"
      >
        <div className="flex items-center md:gap-2 gap-1">
          <div className="pl-1">
            <DemandIndicator demand={model.demand} status={model?.status} />
          </div>
          <span className="font-medium">{model.name}</span>
          <SecureIndicator external={model.external} />
          <span className="text-xs text-slate-500 dark:text-slate-300">
            <FontAwesomeIcon icon={faCalendar} className="mr-1" />
            {model.releaseDate && model.releaseDate !== "" ? model.releaseDate : "-"}
          </span>

        </div>
        <div className="flex items-center gap-2 mt-1">
          <Chip text={model.company} />

          <span className="text-xs text-slate-500 dark:text-slate-300">
            <FontAwesomeIcon icon={faCircleDot} className="mr-1" />
            Context {model.contextLength && model.contextLength !== "" ? model.contextLength : "-"}
          </span>
          <div className="flex items-center gap-1 text-tertiary">
            {model.input.includes("image") && <Tooltip text={"Image Input"}><FontAwesomeIcon icon={faImage} /></Tooltip>}
            {model.input.includes("video") && <Tooltip text={"Video Input"}><FontAwesomeIcon icon={faVideo} /></Tooltip>}
            {model.input.includes("audio") && <Tooltip text={"Audio Input"}><FontAwesomeIcon icon={faMicrophone} /></Tooltip>}
            {model.output.includes("thought") && <Tooltip text={"Thinking"}><FontAwesomeIcon icon={faBrain} /></Tooltip>}
          </div>
          {/*
            <span className="text-xs text-slate-500">
              <FontAwesomeIcon icon={faHashtag} className="mr-1" />
              Param {model.numParameters && model.numParameters !== "" ? model.numParameters : "-"}
            </span>*/}

        </div>
        <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{model.description}</p>

      </div>
    );
  });

  const GridElement = memo(({ idx, model, onClick }: { idx: number, model: ExtendedModelInfo, onClick: () => void }) => {
    return (
      <div
        onClick={onClick}
        tabIndex={idx} data-index={idx} data-id={model.id}
        className="group rounded-2xl border border-slate-200 p-3 h-full hover:bg-slate-100 dark:hover:bg-slate-700 hover:shadow-md transition dark:border-slate-700  focus-within:ring-2 focus-within:ring-indigo-500 flex flex-col justify-between"
      >
        <div className="grid grid-cols-[1fr_auto] gap-2 items-start">
          <div className="">

            <div className="font-semibold tracking-tight">
              <span className="pr-1">
                <SecureIndicator external={model.external} />
              </span>
              {model.name}
            </div>
            <Chip text={model.company} />

          </div>
          <DemandIndicator demand={model.demand} status={model?.status} />
        </div>
        <div className="mt-2 text-sm text-slate-700 dark:text-slate-200 flex flex-wrap gap-x-1 justify-between">
          <div className="flex items-center gap-x-3">
            <span className="flex items-center">
              <FontAwesomeIcon icon={faCircleDot} className="mr-1" />
              Context {model.contextLength && model.contextLength !== "" ? model.contextLength : "-"}
            </span>
            {/*
            <span className="flex items-center">
              <FontAwesomeIcon icon={faLayerGroup} className="mr-1" />
              Param {model.numParameters && model.numParameters !== "" ? model.numParameters : "-"}
            </span>*/}
          </div>
          <div className="flex items-center gap-1">
            {model.output.includes("thought") && (
              <Tooltip text={"Thinking"}>
                <div className="text-tertiary size-9 inline-grid place-items-center rounded-xl border border-slate-200 dark:border-slate-500" aria-label="Text input">
                  <FontAwesomeIcon icon={faBrain} />
                </div>
              </Tooltip>
            )}
            {model.input.includes("image") && (
              <Tooltip text={"Image Input"}>
                <div className="text-tertiary size-9 inline-grid place-items-center rounded-xl border border-slate-200 dark:border-slate-500" aria-label="Text input">
                  <FontAwesomeIcon icon={faImage} />
                </div>
              </Tooltip>
            )}
            {model.input.includes("video") && (
              <Tooltip text={"Video Input"}>
                <div className="text-tertiary size-9 inline-grid place-items-center rounded-xl border border-slate-200 dark:border-slate-500" aria-label="Text input">
                  <FontAwesomeIcon icon={faVideo} />
                </div>
              </Tooltip>
            )}
            {model.input.includes("audio") && (
              <Tooltip text={"Audio Input"}>
                <div className="text-tertiary size-9 inline-grid place-items-center rounded-xl border border-slate-200 dark:border-slate-500" aria-label="Text input">
                  <FontAwesomeIcon icon={faMicrophone} />
                </div>
              </Tooltip>
            )}
          </div>
        </div>

      </div>
    )
  });

  return (

    <div ref={dropdownRef} className="w-full relative dark:text-white">



      {/** Trigger/Input **/}
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="h-13 min-h-[4rem] w-full text-left desktop:w-full border border-gray-200 dark:border-gray-800 rounded-2xl shadow-md bg-white dark:bg-bg_secondary_dark px-3 py-2.5 shadow-sm hover:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30">
        
        {/** Selected Model View **/}
        <div className="flex justify-between">
          <div className="flex items-center justify-between gap-2">
            <div className="pl-2">
              <DemandIndicator demand={selectedModel?.demand} status={selectedModel?.status} />
            </div>
            <span className="font-medium">{selectedModel?.name}</span>
            {selectedModel?.external == true && (<Chip text={"External"} colorPreset={"orange"} />)}
            <Chip text={selectedModel?.company} />
            <span className="text-xs text-slate-500 dark:text-slate-300 hidden sm:inline-block">
              <FontAwesomeIcon icon={faCalendar} />
              {selectedModel?.releaseDate}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-300 hidden sm:inline-block">
              <FontAwesomeIcon icon={faCircleDot} className="mr-1" />
              Context {selectedModel?.contextLength !== "" ? selectedModel?.contextLength : "-"}
            </span>
            {/*
            <span className="text-xs text-slate-500 hidden sm:inline-block">
              <FontAwesomeIcon icon={faLayerGroup} className="mr-1" />
              Param {selectedModel?.numParameters !== "" ? selectedModel?.numParameters : "-"}
            </span>*/}
          </div>

          <div className="flex items-center gap-2">
            <div className="ml-2 flex items-center gap-1 text-tertiary">
              {selectedModel?.input.includes("image") && <Tooltip text={"Image Input"}><FontAwesomeIcon icon={faImage} /></Tooltip>}
              {selectedModel?.input.includes("video") && <Tooltip text={"Video Input"}><FontAwesomeIcon icon={faVideo} /></Tooltip>}
              {selectedModel?.output.includes("thought") && <Tooltip text={"Thinking"}><FontAwesomeIcon icon={faBrain} /></Tooltip>}

            </div>
            <FontAwesomeIcon icon={faChevronDown} />
          </div>
        </div>

      </button>

      {/** Dropdown Panel **/}
      <div className={`${dropdownOpen ? "" : "hidden"} bg-white dark:bg-bg_secondary_dark absolute z-50 mt-1 w-full rounded-2xl border border-slate-200 dark:border-gray-500 shadow-2xl dark:shadow-dark pb-4`}>

        {/** Search Controls **/}
        <div className="text-sm flex items-center gap-2 p-2 border-b border-slate-100 dark:border-gray-500 to-white">
          <div className="relative flex-1">
            <FontAwesomeIcon icon={faMagnifyingGlass} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              type="text" placeholder="Search models…" autoComplete="off" className="w-full rounded-xl border border-slate-200 dark:border-gray-500 pl-9 pr-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30" />
          </div>

          {/** View tabs (kept; default is List) **/}
          <div className=" rounded-xl border border-slate-200 overflow-hidden" role="tablist" aria-label="View mode">
            <button
              onClick={() => setResultViewMode("list")}
              data-view="simple" className="view-btn px-3 py-2 text-sm hover:bg-tertiary/30 aria-selected:bg-tertiary aria-selected:text-white" role="tab" aria-selected={resultViewMode === "list"} title="List">
              <FontAwesomeIcon icon={faList} />
            </button>
            <button
              onClick={() => setResultViewMode("extended")}
              data-view="extended" className="view-btn px-3 py-2 text-sm hover:bg-tertiary/30 aria-selected:bg-tertiary aria-selected:text-white" role="tab" aria-selected={resultViewMode === "extended"} title="Extended">
              <FontAwesomeIcon icon={faRectangleList} />
            </button>
            <button
              onClick={() => setResultViewMode("grid")}
              data-view="grid" className="view-btn px-3 py-2 text-sm hover:bg-tertiary/30 aria-selected:bg-tertiary aria-selected:text-white" role="tab" aria-selected={resultViewMode === "grid"} title="Grid">
              <FontAwesomeIcon icon={faTableCells} />
            </button>
          </div>

          {/** Grouping 
          <div className="hidden sm:flex items-center gap-2 ml-1" title="Group by family">
            <FontAwesomeIcon icon={faLayerGroup} className="text-slate-500" />
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input id="group-toggle" type="checkbox" className="sr-only peer" checked={false} />
              <div className="w-11 h-6 bg-slate-200 rounded-full transition-colors peer-checked:bg-indigo-500"></div>
              <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
            </label>
          </div>**/}

          {/** Filter 
          <Menu as="div" className="relative inline-block text-left ">

            <MenuButton className="h-10 inline-flex w-full justify-between items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/40">
              <FontAwesomeIcon size="sm" icon={faFilter} />
            </MenuButton>

            <MenuItems className="absolute right-0 mt-2 w-40 origin-top-right rounded-xl bg-white shadow-lg ring-1 ring-black/5 focus:outline-none z-50">
              <MenuItem >
                <label className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer" onClick={(event)=>{event.preventDefault()}}>
                  <input type="checkbox" className="filter-out" data-out="thought" checked /> Fast
                </label>
              </MenuItem>
              <MenuItem>
                <label className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                  <input type="checkbox" className="filter-out" data-out="thought" /> Reasoning
                </label>
              </MenuItem>

            </MenuItems>
          </Menu>**/}

          {/** Sort **/}
          <Menu as="div" className="relative inline-block text-left">
            
            <MenuButton className="inline-flex w-full justify-between items-center rounded-xl border border-slate-200 bg-white dark:bg-bg_secondary_dark px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-200 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/40">
              <span className="hidden sm:block">
                {sortOptions.find((opt) => opt.value === sortBy)?.label || "Sort by"}
                <FontAwesomeIcon size="sm" icon={faChevronDown} />
              </span>
              <span className="sm:hidden">
                <FontAwesomeIcon icon={faArrowUpAZ} className="ml-1" />
              </span>
            </MenuButton>

            <MenuItems className="absolute right-0 mt-2 w-40 origin-top-right rounded-xl bg-white dark:bg-bg_secondary_dark shadow-lg ring-1 ring-black/5 focus:outline-none z-50">
              <div className="py-1">
                {sortOptions.map((option) => (
                  <MenuItem key={option.value}>
                    {({ close }) => (
                      <button
                        onClick={() => {setSortBy(option.value); close()}}
                        className="data-focus:bg-tertiary/10 dark:data-focus:bg-secondary rounded-xl text-slate-700 dark:text-slate-200 block w-full px-4 py-2 text-left text-sm"
                      >
                        {option.label}

                      </button>
                    )}
                  </MenuItem>
                ))}
              </div>
            </MenuItems>
          </Menu>
        </div>

        {/** Results List **/}
        <div id="model-listbox" role="listbox" aria-label="Models" tabIndex={-1} className="max-h-110 overflow-auto px-2">
          {resultViewMode === 'list' && (
            <div className="rounded-xl overflow-hidden grid gap-1 py-2">
              {filteredModelsList.map((m, idx) => (
                <ListElement
                  key={m.id} idx={idx} model={m}
                  onClick={() => { setSelectedModel(m); setDropdownOpen(false); }} />
              ))}
            </div>
          )}
          {resultViewMode === 'extended' && (
            <div className="rounded-xl overflow-hidden grid gap-1 py-2">
              {filteredModelsList.map((m, idx) => (
                <ExtendedListElement
                  key={m.id} idx={idx} model={m}
                  onClick={() => { setSelectedModel(m); setDropdownOpen(false); }} />
              ))}
            </div>
          )}

          {resultViewMode === 'grid' && (
            <div className="overflow-hidden grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 py-2">
              {filteredModelsList.map((m, idx) => (
                <span
                  onClick={() => { setSelectedModel(m); setDropdownOpen(false); }}
                >
                  <GridElement
                    key={m.id} idx={idx} model={m}
                    onClick={() => { setSelectedModel(m); setDropdownOpen(false); }} />
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
