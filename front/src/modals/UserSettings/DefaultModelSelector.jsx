import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import ModelSelectorWrapper from "../../components/Header/ModelSelectorWrapper";
import E2eeLock from "../../components/Others/E2eeLock";
import {
  selectDefaultModel,
  setDefaultModel,
} from "../../Redux/reducers/userSettingsReducer";
import { isBrandLocked } from "../../config/brandPolicy";

export default function DefaultModelSelector({ modelsData }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const currentDefaultModel = useSelector(selectDefaultModel);

  // A brand that pins the model has no default to choose: every chat uses it.
  if (isBrandLocked("model")) return null;

  const selectedModel =
    modelsData?.find((m) => m.id === currentDefaultModel?.id) || null;

  /*
  Prefer the row `/models` lists over the stored snapshot. The snapshot carries
  the name and externality of the day the user picked the model, and the
  deployment can correct both for the same id (an in-house bridge model that was
  labelled external); the chip must show what the model is now.
  */
  const displayModel = selectedModel ?? currentDefaultModel;

  const handleChange = (model) => {
    dispatch(
      setDefaultModel({
        name: model.name,
        id: model.id,
        external: model.external,
      }),
    );
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-base-content">
            {t("user_settings.default_model.title")}
          </h3>
          <p className="mt-1 text-xs text-base-content/70">
            {t("user_settings.default_model.description")}
          </p>
        </div>
        {displayModel?.name && (
          <span
            className="flex max-w-[45%] shrink-0 items-center gap-1 rounded-md bg-base-200 px-2 py-1 text-xs font-medium text-base-content/70"
            title={displayModel.name}
          >
            <span className="truncate">{displayModel.name}</span>
            <E2eeLock modelId={displayModel.id} size={12} />
          </span>
        )}
      </div>

      <div
        role="group"
        aria-label={t("user_settings.default_model.list_label")}
        className="max-h-52 overflow-y-auto rounded-lg border border-base-300"
      >
        <ModelSelectorWrapper
          modelsData={modelsData}
          localState={undefined}
          setLocalState={undefined}
          selectedModel={selectedModel}
          onChange={handleChange}
          inHeader={false}
          listOnly
        />
      </div>
    </section>
  );
}
