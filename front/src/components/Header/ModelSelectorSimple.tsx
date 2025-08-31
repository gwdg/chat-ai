
import { useState, useMemo, useEffect, useRef, memo } from "react";
import Tooltip from "../Others/Tooltip";
import { useUpdateModelsData } from "../../hooks/useUpdateModelsData";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useSelector } from "react-redux";
import {
  faChevronDown, faMagnifyingGlass, faBrain, faImage, faVideo,
  faMicrophone,
  faArrowUpAZ
} from '@fortawesome/free-solid-svg-icons'
import { selectDefaultModel } from "../../Redux/reducers/userSettingsReducer";
import DemandIndicator from "./DemandIndicator";
import type { BaseModelInfo } from "../../types/models";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";

const sortOptions = [
  { value: "name-asc", label: "Name (A→Z)" },
  { value: "name-desc", label: "Name (Z→A)" },
];

export default function ModelSelectorSimple({ currentModelId, modelsData, onChange, inHeader = false }: { currentModelId: string | undefined, modelsData: BaseModelInfo[], inHeader: boolean, onChange: (model: BaseModelInfo) => void }) {
  const userDefaultModel = useSelector(selectDefaultModel);

  const selectedModel = modelsData ? modelsData.find(model => model.id === currentModelId) || modelsData.find(model => model.id === userDefaultModel) || modelsData[0] || null : null;

  useEffect(() => {
    if (currentModelId === undefined || currentModelId !== selectedModel?.id) {
      setSelectedModel(selectedModel);
    }
  }, []);

  function setSelectedModel(model: BaseModelInfo | null) {
    onChange && onChange(model);
  }

  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [sortBy, setSortBy] = useState("name-asc"); // name-asc, name-desc, date-asc, date-desc, params-asc, params-desc

  // Dropdown close on click outside logic
  const dropdownRef = useRef(null);
  useEffect(() => {
    if (!dropdownOpen) return;
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
    // Apply sorting based on sortOption
    if (sortBy === "name-asc") {
      result = result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "name-desc") {
      result = result.sort((a, b) => b.name.localeCompare(a.name));
    }
    return result;
  }, [searchQuery, modelsData, sortBy]);

  // use memo to not rerender on search input
  const ListElement = memo(({ idx, model, onClick }: { idx: number, model: BaseModelInfo, onClick: () => void }) => {
    return (
      <div
        onClick={onClick}
        data-index={idx} data-id={model.id} tabIndex={idx}
        className="item cursor-pointer my-1 px-2 py-1 hover:bg-slate-100 rounded-2xl border border-slate-200 dark:border-gray-500 bg-white dark:bg-bg_secondary_dark"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="pl-1">
              <DemandIndicator demand={model.demand} status={model?.status} />
            </div>
            <span className="font-medium">{model.name}</span>
          </div>
          <div className="ml-2 flex items-center gap-1 text-tertiary">
            {model.input.includes("image") && <Tooltip text={"Image Input"}><FontAwesomeIcon icon={faImage} /></Tooltip>}
            {model.input.includes("video") && <Tooltip text={"Video Input"}><FontAwesomeIcon icon={faVideo} /></Tooltip>}
            {model.input.includes("audio") && <Tooltip text={"Audio Input"}><FontAwesomeIcon icon={faMicrophone} /></Tooltip>}
            {model.output.includes("thought") && <Tooltip text={"Thinking"}><FontAwesomeIcon icon={faBrain} /></Tooltip>}
          </div>
        </div>
      </div>
    );
  });

  return (

    <div ref={dropdownRef} className="w-full relative dark:text-white">
      {/** Trigger/Input **/}
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className={`${inHeader ? "border border-gray-200 dark:border-bg_secondary_dark" : " border border-gray-200 dark:border-bg_secondary_dark shadow-md shadow-sm"}  w-full text-center desktop:w-full rounded-xl bg-white dark:bg-bg_secondary_dark px-3 py-2.5 hover:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30`}>
        <div id="trigger-content" className="flex justify-between">
          {/* Left section - allow to shrink */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="pl-2">
              <DemandIndicator demand={selectedModel?.demand} status={selectedModel?.status} />
            </div>
            <span className="font-medium truncate">{selectedModel?.name}</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="ml-2 flex items-center gap-1 text-indigo-600">
              {selectedModel?.input.includes("image") && <Tooltip text={"Image Input"}><FontAwesomeIcon icon={faImage} /></Tooltip>}
              {selectedModel?.input.includes("video") && <Tooltip text={"Video Input"}><FontAwesomeIcon icon={faVideo} /></Tooltip>}
              {selectedModel?.output.includes("thought") && <Tooltip text={"Thinking"}><FontAwesomeIcon icon={faBrain} /></Tooltip>}

            </div>
            <FontAwesomeIcon icon={faChevronDown} />
          </div>
        </div>

      </button>


      {/** Dropdown Panel **/}
      <div className={`${dropdownOpen ? "" : "hidden"} ${inHeader ? "fixed left-0 top-12 w-screen" : "absolute"} bg-white dark:bg-bg_secondary_dark z-50 mt-1 w-full rounded-2xl border border-slate-200 dark:border-gray-500  shadow-2xl dark:shadow-dark pb-4`}>

        {/** Controls **/}
        <div className={`text-sm flex items-center gap-2 p-2 border-b border-slate-100 dark:border-gray-500 to-white`}>
          <div className="relative flex-1">
            <FontAwesomeIcon icon={faMagnifyingGlass} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              type="text" placeholder="Search models…" autoComplete="off" className="w-full rounded-xl border border-slate-200 dark:border-gray-500 pl-9 pr-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30" />
          </div>

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
                        className="data-focus:bg-indigo-50 dark:data-focus:bg-secondary rounded-xl data-focus:text-indigo-600 text-slate-700 dark:text-slate-200 block w-full px-4 py-2 text-left text-sm"
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
        <div id="model-listbox" role="listbox" aria-label="Models" tabIndex={-1} className="max-h-96 overflow-auto px-2">
          <div className="rounded-xl overflow-hidden">
            {filteredModelsList.map((m, idx) => (
              <ListElement
                key={m.id}
                onClick={() => { setSelectedModel(m); setDropdownOpen(false); }}
                idx={idx} model={m} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
