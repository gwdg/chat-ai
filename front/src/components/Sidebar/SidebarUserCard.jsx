import { useTranslation } from "react-i18next";
import { useModal } from "../../modals/ModalContext";
import UserContainer from "../Header/UserContainer";

export default function SidebarUserCard({ localState, userData, modelsData }) {
  const { openModal } = useModal();
  const { t } = useTranslation();

  const name = [userData?.firstname, userData?.lastname]
    .filter(Boolean)
    .join(" ");
  const org = userData?.organization || userData?.org;

  const openUserSettings = () =>
    openModal("userSettings", { localState, userData, modelsData });

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openUserSettings}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openUserSettings();
        }
      }}
      aria-label={t("user_settings.title")}
      className="user-profile-block flex items-center gap-2 px-1 py-1 rounded-2xl cursor-pointer hover:bg-base-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      {/* Presentation only — the whole card is the click target. */}
      <UserContainer
        localState={localState}
        userData={userData}
        modelsData={modelsData}
        interactive={false}
      />
      {(name || org) && (
        <div className="flex-1 min-w-0">
          {name && (
            <p className="truncate text-sm font-medium text-base-content">
              {name}
            </p>
          )}
          {org && (
            <p className="truncate text-xs text-base-content/70">
              {org}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
