import { useEffect } from "react";
import { Clock3 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import { setTimeoutTime } from "../../Redux/reducers/userSettingsReducer";

export default function TimeoutSetter() {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const timeoutTime = useSelector((state) => state.user_settings.timeout);

  useEffect(() => {
    if (!timeoutTime || timeoutTime === 0) {
      dispatch(setTimeoutTime(300000));
    }
  }, [timeoutTime, dispatch]);

  const timeoutInSeconds = timeoutTime ? Math.round(timeoutTime / 1000) : 300;

  const handleTimeoutChange = (event) => {
    const newTimeoutSeconds = parseInt(event.target.value, 10) || 30;
    dispatch(setTimeoutTime(newTimeoutSeconds * 1000));
  };

  return (
    <section className="flex flex-col gap-3">
      <div>
        <div className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-accent" aria-hidden="true" />
          <h3 className="text-sm font-medium text-base-content">
            {t("user_settings.timeout.title")}
          </h3>
        </div>
        <p className="mt-1 text-xs text-base-content/70">
          {t("user_settings.timeout.description")}
        </p>
      </div>
      <div className="max-w-xs">
        <label
          htmlFor="request-timeout-seconds"
          className="mb-2 block text-xs font-medium text-base-content"
        >
          {t("user_settings.timeout.seconds")}
        </label>
        <div className="relative">
          <input
            id="request-timeout-seconds"
            type="number"
            min="5"
            max="900"
            step="5"
            value={timeoutInSeconds}
            onChange={handleTimeoutChange}
            className="input w-full pr-14 text-sm"
          />
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-base-content/70">
            {t("user_settings.timeout.seconds_short")}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-base-content/70">
          {t("user_settings.timeout.range")}
        </p>
      </div>
    </section>
  );
}
