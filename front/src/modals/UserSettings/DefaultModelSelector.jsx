import { faCheck, faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useSelector, useDispatch } from "react-redux";

import icon_support_vision from "../../assets/icons/support_vision.svg";
import icon_support_audio from "../../assets/icons/support_audio.svg";
import icon_support_video from "../../assets/icons/support_video.svg";
import icon_support_reasoning from "../../assets/icons/support_reasoning.svg";
import icon_support_arcana from "../../assets/icons/support_arcana.svg";
import DemandStatusIcon from "../../components/Header/DemandStatusIcon";
import { selectDefaultModel, setDefaultModel } from "../../Redux/reducers/userSettingsReducer";
import { matchesModelSearch, sortModelsByName } from "../../utils/models";

export default function DefaultModelSelector({ modelsData }) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const currentDefaultModel = useSelector(selectDefaultModel);
    const [searchQuery, setSearchQuery] = useState("");

    const filteredModels = useMemo(() => {
        const sortedModels = sortModelsByName(modelsData);
        const result = sortedModels.filter((model) => matchesModelSearch(model, searchQuery));
        const selectedIndex = result.findIndex((model) => model.id === currentDefaultModel?.id);

        if (selectedIndex <= 0) {
            return result;
        }

        const selectedModel = result[selectedIndex];
        return [
            selectedModel,
            ...result.slice(0, selectedIndex),
            ...result.slice(selectedIndex + 1),
        ];
    }, [currentDefaultModel?.id, modelsData, searchQuery]);

    const handleChangeDefaultModel = (model) => {
    dispatch(setDefaultModel({
        name: model.name,
        id: model.id,
    }));
    };

    return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium dark:text-white">
              <Trans i18nKey="user_settings.default_model.title" />
              {": "}
              { currentDefaultModel?.name }
            </p>
          </div>
          {/* Default Model Selector */}
        
        <p className="text-xs text-gray-500 dark:text-gray-400">
            <Trans i18nKey="user_settings.default_model.description" />
        </p>
        <div className="relative">
          <FontAwesomeIcon
            icon={faMagnifyingGlass}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            type="text"
            placeholder={t("user_settings.default_model.search_placeholder")}
            autoComplete="off"
            className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 pl-9 pr-3 py-2 text-sm text-slate-700 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>
        <div className="border dark:border-border_dark rounded-2xl overflow-hidden max-h-56 overflow-y-auto">
        {filteredModels.map((option) => (
            <button
            type="button"
            key={option.id}
            onClick={() => handleChangeDefaultModel(option)}
            aria-pressed={currentDefaultModel?.id === option.id}
            className={`flex items-start gap-2 text-left text-tertiary text-sm w-full px-3 py-1.5 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
                currentDefaultModel?.id === option.id
                ? "bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500"
                : ""
            }`}
            >
            <DemandStatusIcon status={option?.status} demand={option?.demand} />
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-slate-800 dark:text-slate-100">
                        {option.name}
                    </span>
                    {currentDefaultModel?.id === option.id && (
                        <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                            {t("user_settings.default_model.current_badge")}
                        </span>
                    )}
                </div>
                <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {option.id}
                </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 pt-0.5">
            {option.input?.includes("audio") && (
                <img src={icon_support_audio} alt="audio" className="h-[16px] w-[16px]" />
            )}
            {option.input?.includes("image") && (
                <img src={icon_support_vision} alt="image" className="h-[16px] w-[16px]" />
            )}
            {option.input?.includes("video") && (
                <img src={icon_support_video} alt="video" className="h-[16px] w-[16px]" />
            )}
            {option.output?.includes("thought") && (
                <img src={icon_support_reasoning} alt="thought" className="h-[16px] w-[16px]" />
            )}
            {option.input?.includes("arcana") && (
                <img src={icon_support_arcana} alt="books" className="h-[16px] w-[16px]" />
            )}
            {currentDefaultModel?.id === option.id && (
                <FontAwesomeIcon icon={faCheck} className="text-blue-600 dark:text-blue-300" />
            )}
            </div>
            </button>
        ))}
        {filteredModels.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                {t("user_settings.default_model.no_results", { query: searchQuery.trim() })}
            </div>
        )}
    </div>
    </div>
    );
};
