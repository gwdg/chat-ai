import { Trans } from "react-i18next";
import Model from "./Model";
import cross from "../assets/cross.svg";

function Settings_Model(props) {
  const handleLogout = () => {
    window.location.href =
      "https://keycloak.sso.gwdg.de/auth/realms/academiccloud/protocol/openid-connect/logout";
  };

  return (
    <Model showModel={props.showModel} isSettingsModel={true}>
      <div className="select-none border dark:border-border_dark rounded-2xl bg-white dark:bg-black md:min-w-[700px] h-fit md:max-w-[350px]">
        {/* Model header */}
        <div className="flex justify-between items-center px-4 pt-4">
          <p className="text-xl text-tertiary">User Profile</p>
          <img
            src={cross}
            alt="cross"
            className="h-[30px] w-[30px] cursor-pointer p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            onClick={() => props.showModel(false)}
          />
        </div>

        {/* User Profile Section */}
        <div className="p-4 flex items-center justify-between gap-3 border-b dark:border-border_dark">
          <div className="flex flex-col">
            <span className="font-medium text-lg dark:text-white">
              {props.userData.firstname + " " + props.userData.lastname ||
                "Loading..."}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {props.userData.organization || "Loading..."}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="font-medium text-lg dark:text-white">
              {props.userData.username || "Loading..."}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {props.userData.email || "Loading..."}
            </span>
          </div>
          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="max-w-[250px] w-full p-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-white rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            <p>Logout</p>
          </button>
        </div>

        {/* Settings Content */}
        <div className="p-4 flex flex-col gap-3">
          {/* Clear Chats Section */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <p className="text-base font-medium dark:text-white">
                Clear All Chats
              </p>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              This will permanently delete all your chat history and cannot be
              undone.
            </p>
            <div className="w-full flex justify-center">
              {" "}
              <button
                className="max-w-[250px] w-full p-3 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl flex items-center justify-center gap-2 transition-colors"
                onClick={() => props.setShowCacheModel(true)}
              >
                <Trans i18nKey="description.file2" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Model>
  );
}

export default Settings_Model;
