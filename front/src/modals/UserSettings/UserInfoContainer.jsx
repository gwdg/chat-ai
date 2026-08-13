import { AtSign, Building2, LogOut, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import {
  selectShowUsageInSidebar,
  setShowUsageInSidebar,
} from "../../Redux/reducers/interfaceSettingsSlice";
import UserLimitsDisplay from "./UserLimitsDisplay";
import OrgLimitsDisplay from "./OrgLimitsDisplay";
import ProfilePreferenceSwitch from "./ProfilePreferenceSwitch";

export default function UserInfoContainer({ userData }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const showUsageInSidebar = useSelector(selectShowUsageInSidebar);
  const firstName = userData?.firstname ?? "";
  const lastName = userData?.lastname ?? "";
  const fullName = `${firstName} ${lastName}`.trim();
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  const handleLogout = () => {
    window.location.href =
      "https://keycloak.sso.gwdg.de/auth/realms/academiccloud/protocol/openid-connect/logout";
  };

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-tertiary/10 text-sm font-semibold text-tertiary dark:bg-tertiary/20 dark:text-blue-300">
              {initials || "?"}
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                {fullName || t("common.loading")}
              </h3>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-gray-500 dark:text-gray-400">
                <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">
                  {userData?.organization ?? t("common.loading")}
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tertiary/50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {t("user_settings.logout")}
          </button>
        </div>

        <dl className="grid gap-3 border-t border-gray-200 pt-4 dark:border-gray-700 sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
              {/* <AtSign className="h-3.5 w-3.5" aria-hidden="true" /> */}
              {t("user_settings.account.username")}
            </dt>
            <dd
              className="mt-1 truncate text-sm text-gray-800 dark:text-gray-100"
              title={userData?.username}
            >
              {userData?.username ?? t("common.loading")}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
              <Mail className="h-3.5 w-3.5" aria-hidden="true" />
              {t("user_settings.account.email")}
            </dt>
            <dd
              className="mt-1 truncate text-sm text-gray-800 dark:text-gray-100"
              title={userData?.email}
            >
              {userData?.email ?? t("common.loading")}
            </dd>
          </div>
        </dl>
      </section>

      {userData?.limits && (
        <section className="flex flex-col gap-3 border-t border-gray-200 pt-5 dark:border-gray-700">
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">
              {t("user_settings.usage.title")}
            </h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t("user_settings.usage.description")}
            </p>
          </div>
          <UserLimitsDisplay limits={userData.limits} />
          <OrgLimitsDisplay limits={userData.limits} />
          <div className="border-t border-gray-200 pt-1 dark:border-gray-700">
            <ProfilePreferenceSwitch
              label={t("user_settings.sidebar_usage.label")}
              description={t("user_settings.sidebar_usage.description")}
              checked={showUsageInSidebar}
              onChange={(checked) =>
                dispatch(setShowUsageInSidebar(checked))
              }
            />
          </div>
        </section>
      )}
    </div>
  );
}
