import { Trans, useTranslation } from "react-i18next";

export default function UserInfoContainer({ userData }) {
    const handleLogout = () => {
     window.location.href =
     "https://keycloak.sso.gwdg.de/auth/realms/academiccloud/protocol/openid-connect/logout";
    };
    
    return (
      <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b dark:border-border_dark flex-shrink-0">
        <div className="flex flex-col">
          <span className="font-medium text-sm dark:text-white">
            {(() => {
              const first = userData?.firstname ?? "";
              const last = userData?.lastname ?? "";
              return first === "" && last === "" ? (
                <Trans i18nKey="description.common.loading" />
              ) : (
                `${first} ${last}`.trim()
              );
            })()}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {userData?.organization ?? (
              <Trans i18nKey="description.common.loading" />
            )}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="font-medium text-sm dark:text-white">
            {userData?.username ?? (
              <Trans i18nKey="description.common.loading" />
            )}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {userData?.email ?? <Trans i18nKey="description.common.loading" />}
          </span>
        </div>
        {/* Logout */}
        <button
          onClick={handleLogout}
          className="cursor-pointer w-full sm:max-w-[200px] p-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-white rounded-xl flex items-center justify-center gap-2 transition-colors"
        >
          <p className="text-sm">
            <Trans i18nKey="description.settings.logout" />
          </p>
        </button>
      </div>
    );
}