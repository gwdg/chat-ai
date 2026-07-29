import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import icon_support_vision from "../../assets/icons/support_vision.svg";
import icon_support_audio from "../../assets/icons/support_audio.svg";
import icon_support_video from "../../assets/icons/support_video.svg";
import icon_support_reasoning from "../../assets/icons/support_reasoning.svg";
import icon_support_arcana from "../../assets/icons/support_arcana.svg";
import DemandStatusIcon from "../../components/Header/DemandStatusIcon";
import {
  selectDefaultModel,
  setDefaultModel,
} from "../../Redux/reducers/userSettingsReducer";

export default function DefaultModelSelector({ modelsData }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const currentDefaultModel = useSelector(selectDefaultModel);

  const handleChangeDefaultModel = (model) => {
    dispatch(
      setDefaultModel({
        name: model.name,
        id: model.id,
      }),
    );
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">
            {t("user_settings.default_model.title")}
          </h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {t("user_settings.default_model.description")}
          </p>
        </div>
        {currentDefaultModel?.name && (
          <span
            className="max-w-[45%] shrink-0 truncate rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300"
            title={currentDefaultModel.name}
          >
            {currentDefaultModel.name}
          </span>
        )}
      </div>

      <div
        role="group"
        aria-label={t("user_settings.default_model.list_label")}
        className="max-h-52 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700"
      >
        {modelsData.map((option) => {
          const selected = currentDefaultModel?.id === option.id;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={selected}
              onClick={() => handleChangeDefaultModel(option)}
              className={`flex min-h-10 w-full items-center gap-2 border-b border-gray-100 px-3 py-2 text-left text-sm transition-colors last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tertiary/50 dark:border-gray-800 ${
                selected
                  ? "bg-tertiary/10 text-tertiary dark:bg-tertiary/20 dark:text-blue-300"
                  : "text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800/70"
              }`}
            >
              <DemandStatusIcon status={option?.status} demand={option?.demand} />
              <span className="min-w-0 flex-1 truncate">{option.name}</span>
              <span className="flex shrink-0 items-center gap-1.5">
                {option.input?.includes("audio") && (
                  <img src={icon_support_audio} alt="" className="h-4 w-4" />
                )}
                {option.input?.includes("image") && (
                  <img src={icon_support_vision} alt="" className="h-4 w-4" />
                )}
                {option.input?.includes("video") && (
                  <img src={icon_support_video} alt="" className="h-4 w-4" />
                )}
                {option.output?.includes("thought") && (
                  <img
                    src={icon_support_reasoning}
                    alt=""
                    className="h-4 w-4"
                  />
                )}
                {option.input?.includes("arcana") && (
                  <img src={icon_support_arcana} alt="" className="h-4 w-4" />
                )}
                {selected && (
                  <Check className="ml-1 h-4 w-4" aria-hidden="true" />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
