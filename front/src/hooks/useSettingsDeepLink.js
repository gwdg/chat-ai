import { useEffect } from "react";

import { useModal } from "../modals/ModalContext";

const SETTINGS_TABS = new Set(["profile", "chat", "memories", "data"]);

export function useSettingsDeepLink({ localState, userData, modelsData }) {
  const { openModal } = useModal();

  useEffect(() => {
    const handleOpenSettings = (event) => {
      const requestedTab = event.detail?.tab;
      const initialTab = SETTINGS_TABS.has(requestedTab)
        ? requestedTab
        : "profile";
      openModal("userSettings", {
        localState,
        userData,
        modelsData,
        initialTab,
      });
    };

    window.addEventListener("chatai:open-settings", handleOpenSettings);
    return () =>
      window.removeEventListener("chatai:open-settings", handleOpenSettings);
  }, [openModal, localState, userData, modelsData]);
}
