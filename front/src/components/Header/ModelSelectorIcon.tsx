import { memo, useEffect, useRef, useState } from 'react';
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowUpAZ,
    faBookOpen,
    faBrain,
    faCircleInfo,
    faChevronDown,
    faImage,
    faMagnifyingGlass,
    faMicrophone,
    faVideo,
    faRobot,
    faCog
} from '@fortawesome/free-solid-svg-icons';
import type { ModelInfo } from '../../types/models';
import Tooltip from "../Others/Tooltip";
import DemandIndicator from "./DemandIndicator";
import { Settings } from 'lucide-react';

const sortOptions = [
    { value: "name-asc", label: "Name (A→Z)" },
    { value: "name-desc", label: "Name (Z→A)" },
];

interface ModelSelectorIconProps {
    selectedModel: ModelInfo | null;
    modelsData: ModelInfo[];
    onChange: (model: ModelInfo) => void;
    inHeader?: boolean;
}

function ModelSelectorIcon({
    selectedModel,
    modelsData,
    onChange,
    inHeader = false
}: ModelSelectorIconProps) {

    const { t } = useTranslation();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState("name-asc");
    const [buttonPosition, setButtonPosition] = useState({ top: 0, right: 0 });
    const dropdownRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    // Update button position when dropdown opens
    useEffect(() => {
        if (dropdownOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const dropdownHeight = 400; // Estimated max height
            setButtonPosition({
                top: Math.max(8, rect.top - .5*dropdownHeight), // Align to top, ensure it doesn't go off-screen
                right: window.innerWidth - 2.5*rect.right,
            });
        }
    }, [dropdownOpen]);

    const handleToggleDropdown = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Toggling dropdown, current state:', dropdownOpen);
        setDropdownOpen(!dropdownOpen);
    };

    // Dropdown close on click outside logic
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const filteredModelsList = (modelsData || []).filter((model) => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return true;

        const inputOutput = [...(model.input || []), ...(model.output || [])].join(" ").toLowerCase();
        return (
            model.name.toLowerCase().includes(q) ||
            model.id.toLowerCase().includes(q) ||
            inputOutput.includes(q)
        );
    }).sort((a, b) => {
        if (sortBy === "name-asc") {
            return a.name.localeCompare(b.name);
        } else if (sortBy === "name-desc") {
            return b.name.localeCompare(a.name);
        }
        return 0;
    });

    return (
        <div ref={dropdownRef} className="relative">
            {/* Icon Trigger */}
            <button
                ref={buttonRef}
                onClick={handleToggleDropdown}
                type="button"
                className={`
                    ${inHeader ? "p-2 rounded-lg" : "p-3 rounded-xl"}
                    hover:bg-slate-100 dark:hover:bg-slate-700
                    transition-colors duration-200
                    relative
                    ${dropdownOpen ? 'bg-slate-100 dark:bg-slate-700' : ''}
                `}
                aria-label="Select model"
                aria-expanded={dropdownOpen}
                title={selectedModel?.name || "Select model"}
            >
                <Settings
                    className="cursor-pointer h-7 w-7 text-[#009EE0]"
                />
                {selectedModel?.status === "ready" && (
                    <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-bg-primary"></span>
                )}
            </button>

            {/* Dropdown Panel */}
            {dropdownOpen && (
                <div
                    className={`
                        fixed w-96 max-w-[calc(100vw-16px)]
                        bg-white dark:bg-bg_secondary_dark z-[9999]
                        rounded-xl border border-slate-200 dark:border-gray-500
                        shadow-2xl dark:shadow-dark
                    `}
                    style={{
                        top: inHeader ? '56px' : `${buttonPosition.top}px`,
                        right: inHeader ? '0' : `${buttonPosition.right}px`,
                        bottom: 'auto',
                    }}
                >
                    {/* Header Section */}
                    <div className="px-3 pt-3 pb-2 border-b border-slate-200 dark:border-gray-600">
                        <div className="flex items-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-600 dark:text-slate-200">
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

                    {/* Search and Sort Controls */}
                    <div className="p-2 border-b border-slate-200 dark:border-gray-600">
                        <div className="flex items-center gap-2">
                            {/* Search Input */}
                            <div className="relative flex-1">
                                <FontAwesomeIcon
                                    icon={faMagnifyingGlass}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"
                                />
                                <input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    type="text"
                                    placeholder="Search models..."
                                    autoComplete="off"
                                    className="w-full rounded-lg border border-slate-200 dark:border-gray-500 
                           pl-8 pr-3 py-1.5 text-sm
                           focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30
                           bg-white dark:bg-bg_secondary_dark
                           text-slate-700 dark:text-slate-200"
                                />
                            </div>

                            {/* Sort Dropdown */}
                            <Menu as="div" className="relative">
                                <MenuButton className="
                  inline-flex items-center justify-between
                  rounded-lg border border-slate-200 dark:border-gray-500
                  bg-white dark:bg-bg_secondary_dark px-2.5 py-1.5
                  text-xs font-medium text-slate-600 dark:text-slate-200
                  hover:bg-slate-50 dark:hover:bg-slate-700
                  focus:outline-none focus:ring-2 focus:ring-indigo-500/40
                  min-w-[80px]
                ">
                                    <span className="hidden sm:inline">
                                        {sortOptions.find((opt) => opt.value === sortBy)?.label || "Sort"}
                                    </span>
                                    <span className="sm:hidden">
                                        <FontAwesomeIcon icon={faArrowUpAZ} />
                                    </span>
                                    <FontAwesomeIcon icon={faChevronDown} className="ml-1 text-xs" />
                                </MenuButton>

                                <MenuItems className="
                  absolute right-0 mt-2 w-32 origin-top-right
                  rounded-lg bg-white dark:bg-bg_secondary_dark
                  shadow-lg ring-1 ring-black/5 focus:outline-none z-50
                ">
                                    <div className="py-1">
                                        {sortOptions.map((option) => (
                                            <MenuItem key={option.value}>
                                                {({ close }) => (
                                                    <button
                                                        onClick={() => { setSortBy(option.value); close() }}
                                                        className="w-full px-3 py-1.5 text-left text-sm
                                     text-slate-700 dark:text-slate-200
                                     hover:bg-slate-100 dark:hover:bg-slate-700
                                     focus:outline-none"
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
                    </div>

                    {/* Model List */}
                    <div
                        role="listbox"
                        aria-label="Models"
                        className="max-h-80 overflow-y-auto px-2 py-2"
                    >
                        {filteredModelsList.length === 0 ? (
                            <div className="text-center py-4 text-sm text-slate-500 dark:text-slate-400">
                                No models found
                            </div>
                        ) : (
                            filteredModelsList.map((model) => (
                                <button
                                    key={model.id}
                                    onClick={() => {
                                        onChange(model);
                                        setDropdownOpen(false);
                                    }}
                                    className={`
                    w-full flex items-center justify-between gap-2
                    mb-1 px-3 py-2 rounded-lg
                    transition-colors duration-150
                    ${selectedModel?.id === model.id
                                            ? "bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700"
                                            : "hover:bg-slate-100 dark:hover:bg-slate-700 border border-transparent"
                                        }
                  `}
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <DemandIndicator demand={model.demand} status={model.status} />
                                        <div className="flex-1 min-w-0 text-left">
                                            <div className="font-medium text-sm text-slate-700 dark:text-slate-200 truncate">
                                                {model.name}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-tertiary">
                                        {model.input?.includes("image") && (
                                            <Tooltip text="Image Input">
                                                <FontAwesomeIcon icon={faImage} className="text-xs" />
                                            </Tooltip>
                                        )}
                                        {model.input?.includes("video") && (
                                            <Tooltip text="Video Input">
                                                <FontAwesomeIcon icon={faVideo} className="text-xs" />
                                            </Tooltip>
                                        )}
                                        {model.input?.includes("audio") && (
                                            <Tooltip text="Audio Input">
                                                <FontAwesomeIcon icon={faMicrophone} className="text-xs" />
                                            </Tooltip>
                                        )}
                                        {model.input?.includes("arcana") && (
                                            <Tooltip text="Arcana Input">
                                                <FontAwesomeIcon icon={faBookOpen} className="text-xs" />
                                            </Tooltip>
                                        )}
                                        {model.output?.includes("thought") && (
                                            <Tooltip text="Thinking">
                                                <FontAwesomeIcon icon={faBrain} className="text-xs" />
                                            </Tooltip>
                                        )}
                                    </div>
                                </button>
                            ))
                        )}
                    </div>

                    {/* Current Model Display */}
                    {selectedModel && (
                        <div className="px-3 py-2 border-t border-slate-200 dark:border-gray-600 bg-slate-50 dark:bg-slate-800/50 rounded-b-xl">
                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                                Current: {selectedModel.name}
                            </div>
                            <div className="flex items-center gap-1.5 text-tertiary text-xs">
                                {selectedModel.input?.includes("image") && (
                                    <Tooltip text="Image Input">
                                        <FontAwesomeIcon icon={faImage} />
                                    </Tooltip>
                                )}
                                {selectedModel.input?.includes("video") && (
                                    <Tooltip text="Video Input">
                                        <FontAwesomeIcon icon={faVideo} />
                                    </Tooltip>
                                )}
                                {selectedModel.input?.includes("audio") && (
                                    <Tooltip text="Audio Input">
                                        <FontAwesomeIcon icon={faMicrophone} />
                                    </Tooltip>
                                )}
                                {selectedModel.input?.includes("arcana") && (
                                    <Tooltip text="Arcana Input">
                                        <FontAwesomeIcon icon={faBookOpen} />
                                    </Tooltip>
                                )}
                                {selectedModel.output?.includes("thought") && (
                                    <Tooltip text="Thinking">
                                        <FontAwesomeIcon icon={faBrain} />
                                    </Tooltip>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default memo(ModelSelectorIcon);