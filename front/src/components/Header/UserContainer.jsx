import { useModal } from "../../modals/ModalContext";
import { User } from "@carbon/icons-react";

export default function UserContainer({
  localState,
  modelsData,
  userData,
  // When false, the avatar is presentation only — for callers that make a
  // larger surface clickable and must not nest interactive elements.
  interactive = true,
}) {
  const { openModal } = useModal();
  /**
   * Extracts initials from username for avatar display
   * Handles both dot-separated names (e.g., "john.doe") and regular usernames
   */
  const getInitials = (username) => {
    if (!username) return "";

    if (username.includes(".")) {
      const [first, last] = username.split(".");
      return (first.charAt(0) + last.charAt(0)).toUpperCase();
    }

    return username.slice(0, 2).toUpperCase();
  };

  const avatar = userData?.username ? (
    <div className="user-profile-button w-9 h-9 rounded-lg border-2 border-tertiary flex items-center justify-center bg-gray-50 dark:bg-gray-800">
      <span className="text-tertiary font-medium text-sm">
        {getInitials(userData.username)}
      </span>
    </div>
  ) : (
    <User size={20} className="h-full w-full text-tertiary" />
  );

  if (!interactive) {
    return userData?.username ? (
      avatar
    ) : (
      <span className="h-9 w-9 p-2 flex items-center justify-center">
        {avatar}
      </span>
    );
  }

  return userData?.username ? (
    <div
      className="cursor-pointer dark:border-gray-700 hover:opacity-80 transition-opacity touch-manipulation"
      onClick={() =>
        openModal("userSettings", { localState, userData, modelsData })
      }
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      {avatar}
    </div>
  ) : (
    <button
      className="h-9 w-9 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors rounded-lg p-2 touch-manipulation border-l border-gray-200 dark:border-gray-700 ml-3"
      onClick={() =>
        openModal("userSettings", { localState, userData, modelsData })
      }
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      {avatar}
    </button>
  );
}
