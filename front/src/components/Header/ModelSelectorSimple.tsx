
import { useState, useMemo, useEffect, useRef, memo } from "react";
import Tooltip from "../Others/Tooltip";
import { useUpdateModelsData } from "../../hooks/useUpdateModelsData";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useSelector } from "react-redux";
import {
  faChevronDown, faMagnifyingGlass, faBrain, faImage, faVideo
} from '@fortawesome/free-solid-svg-icons'
import { selectDefaultModel } from "../../Redux/reducers/userSettingsReducer";
import DemandIndicator from "./DemandIndicator";
import type { BaseModelInfo } from "../../types/models";
import SidebarToggleMobile from "../Sidebar/SidebarToggleMobile";

export default function ModelSelectorSimple({ currentModelId, modelsData: modelsData, onChange }: { currentModelId: string | undefined, modelsList: BaseModelInfo[], onChange: (model: BaseModelInfo) => void }) {
  const userDefaultModel = useSelector(selectDefaultModel);

  const selectedModel = modelsData ? modelsData.find(model => model.id === currentModelId) || modelsData.find(model => model.id === userDefaultModel) || modelsData[0] || null : null;

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
        className="item cursor-pointer my-1 px-2 py-1 hover:bg-slate-100 rounded-2xl border border-slate-200 bg-white"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="pl-1">
              <DemandIndicator demand={model.demand} online={model.status === "ready"} />
            </div>
            <span className="font-medium">{model.name}</span>
          </div>
          <div className="ml-2 flex items-center gap-1 text-indigo-600">
            {model.input.includes("image") && <Tooltip text={"Image Input"}><FontAwesomeIcon icon={faImage} /></Tooltip>}
            {model.input.includes("video") && <Tooltip text={"Video Input"}><FontAwesomeIcon icon={faVideo} /></Tooltip>}
            {model.output.includes("thought") && <Tooltip text={"Thinking"}><FontAwesomeIcon icon={faBrain} /></Tooltip>}
          </div>
        </div>
      </div>
    );
  });

  return (

    <div ref={dropdownRef} className="w-full">


      {/** Trigger/Input **/}
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="w-full text-left desktop:w-full border border-gray-200 dark:border-gray-800 rounded-xl shadow-md bg-white px-3 py-2.5 shadow-sm hover:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30">
        <div id="trigger-content" className="flex justify-between">
          <div className="flex items-center justify-between gap-2">
            <div className="pl-2">
              <DemandIndicator demand={selectedModel?.demand} online={selectedModel?.status === "ready"} />
            </div>
            <span className="font-medium">{selectedModel?.name}</span>
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
      <div className={`${dropdownOpen ? "" : "hidden"} absolute z-50 mt-1 w-full rounded-2xl border border-slate-200 bg-white shadow-2xl  pb-4`}>

        {/** Controls **/}
        <div className="text-sm flex items-center gap-2 p-2 border-b border-slate-100 to-white">
          <div className="relative flex-1">
            <FontAwesomeIcon icon={faMagnifyingGlass} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              type="text" placeholder="Search models…" autoComplete="off" className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30" />
          </div>

          {/** Sort **/}
          <label className="md:flex items-center text-sm text-slate-600">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              id="sort-select" className="text-xs rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500/30">
              <option value="name-asc">Name (A→Z)</option>
              <option value="name-desc">Name (Z→A)</option>
            </select>
          </label>
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
