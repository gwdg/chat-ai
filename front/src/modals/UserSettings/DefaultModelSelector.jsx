import { Trans, useTranslation } from "react-i18next";
import { useSelector, useDispatch } from "react-redux";

import icon_support_vision from "../../assets/icons/support_vision.svg";
import icon_support_audio from "../../assets/icons/support_audio.svg";
import icon_support_video from "../../assets/icons/support_video.svg";
import icon_support_reasoning from "../../assets/icons/support_reasoning.svg";
import icon_support_arcana from "../../assets/icons/support_arcana.svg";
import DemandStatusIcon from "../../components/Header/DemandStatusIcon";
import { selectDefaultModel, setDefaultModel } from "../../Redux/reducers/userSettingsReducer";

export default function DefaultModelSelector({ modelsData }) {
    const dispatch = useDispatch();
    const currentDefaultModel = useSelector(selectDefaultModel);

    const handleChangeDefaultModel = (model) => {
    dispatch(setDefaultModel({
        name: model.name,
        id: model.id,
    }));
    };

    return (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium dark:text-white">
              <Trans i18nKey="description.settings.defaultModelTitle" />
              {": "}
              { currentDefaultModel?.name }
            </p>
          </div>
          {/* Default Model Selector */}
        
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            <Trans i18nKey="description.settings.defaultModelDescription" />
        </p>
        <div className="border dark:border-border_dark rounded-2xl overflow-hidden max-h-48 overflow-y-auto">
        {modelsData.map((option, index) => (
            <div
            key={index}
            onClick={() => handleChangeDefaultModel(option)}
            className={`flex items-center gap-2 text-tertiary text-sm w-full px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
                currentDefaultModel?.id === option.id
                ? "bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500"
                : ""
            }`}
            >
            <DemandStatusIcon status={option?.status} demand={option?.demand} />
            <div className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                {option.name}
            </div>
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
            </div>
        ))}
    </div>
    </div>
    );
};