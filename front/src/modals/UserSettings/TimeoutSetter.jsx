import { Trans, useTranslation } from "react-i18next";
import { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { setTimeoutTime } from "../../Redux/reducers/timeoutReducer";

export default function TimeoutSetter () {
    const dispatch = useDispatch();
    const timeoutTime = useSelector((state) => state.timeout.timeoutTime);

    useEffect(() => {
        if (!timeoutTime || timeoutTime === 0) {
            dispatch(setTimeoutTime(300000)); // default 300 seconds
        }
    }, [timeoutTime, dispatch]);
    
    const timeoutInSeconds = timeoutTime ? Math.round(timeoutTime / 1000) : 30;

    const handleTimeoutChange = (event) => {
    const newTimeoutSeconds = parseInt(event.target.value) || 30;
    dispatch(setTimeoutTime(newTimeoutSeconds * 1000));
    };

    return (
        <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
        <span className="text-sm">⏱️</span>
        <p className="text-sm font-medium dark:text-white">
            <Trans i18nKey="description.settings_timeout.requestTimeout" defaultValue="Request Timeout" />
        </p>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
        <Trans
            i18nKey="description.settings_timeout.requestTimeoutDescription"
            defaultValue="Set how long to wait for AI responses before timing out."
        />
        </p>
        <div className="flex items-center gap-3">
        <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Trans i18nKey="description.settings_timeout.timeoutSeconds" defaultValue="Timeout (seconds)" />
            </label>
            <div className="relative">
            <input
                type="number"
                min="5"
                max="900"
                step="5"
                value={timeoutInSeconds}
                onChange={handleTimeoutChange}
                className="w-full pl-3 pr-16 py-2 border dark:border-border_dark rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none text-sm"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 dark:text-gray-400">
                secs
            </span>
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
            <Trans i18nKey="description.settings_timeout.timeoutRange" defaultValue="Range: 5-300 seconds" />
            </p>
        </div>
        </div>
    </div>
    )
};