import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import {
  selectShowUsageInSidebar,
  setShowUsageInSidebar,
} from "../../Redux/reducers/interfaceSettingsSlice";
import UserLimitsDisplay from "./UserLimitsDisplay";
import OrgLimitsDisplay from "./OrgLimitsDisplay";
import ProfilePreferenceSwitch from "./ProfilePreferenceSwitch";

// The Usage tab: the monthly and organization budgets, plus the switch that
// repeats the same figures in the sidebar.
export default function UsageSettings({ userData }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const showUsageInSidebar = useSelector(selectShowUsageInSidebar);
  const limits = userData?.limits;

  if (!limits) {
    return (
      <p className="text-sm text-base-content/70">
        {t("user_settings.usage.empty")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <UserLimitsDisplay limits={limits} />
        <OrgLimitsDisplay limits={limits} />
      </div>
      <div className="border-t border-base-300 pt-3">
        <ProfilePreferenceSwitch
          label={t("user_settings.sidebar_usage.label")}
          description={t("user_settings.sidebar_usage.description")}
          checked={showUsageInSidebar}
          onChange={(checked) => dispatch(setShowUsageInSidebar(checked))}
        />
      </div>
    </div>
  );
}
