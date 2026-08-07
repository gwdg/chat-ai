import { SlidersHorizontal } from "lucide-react";
import { useModal } from "../../modals/ModalContext";
import UserContainer from "../Header/UserContainer";
import WarningExternalModel from "../Header/WarningExternalModel";

export default function SidebarUserCard({ localState, userData, modelsData }) {
  const { openModal } = useModal();

  const name = [userData?.firstname, userData?.lastname]
    .filter(Boolean)
    .join(" ");
  const org = userData?.organization || userData?.org;

  return (
    <div className="flex items-center gap-2 px-1">
      <UserContainer
        localState={localState}
        userData={userData}
        modelsData={modelsData}
      />
      {(name || org) && (
        <div className="flex-1 min-w-0">
          {name && (
            <p className="truncate text-sm font-medium text-black dark:text-white">
              {name}
            </p>
          )}
          {org && (
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">
              {org}
            </p>
          )}
        </div>
      )}
      <WarningExternalModel localState={localState} userData={userData} />
      <button
        type="button"
        onClick={() =>
          openModal("userSettings", { localState, userData, modelsData })
        }
        className="cursor-pointer h-9 w-9 flex-shrink-0 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-label="User settings"
      >
        <SlidersHorizontal className="h-5 w-5 text-[#009EE0]" />
      </button>
    </div>
  );
}
