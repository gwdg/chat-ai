import { useCallback, useSyncExternalStore } from "react";

import {
  canInstallApp,
  subscribeInstallPrompt,
  takeInstallPrompt,
} from "../utils/installPrompt";

const noStore = () => false;

/**
 * PWA install affordance.
 *
 * The browser's `beforeinstallprompt` event is stashed by `utils/installPrompt`
 * (module state, because the event is fired once and usable once). This hook
 * only subscribes and offers the prompt. A browser that never fires the event —
 * Firefox, or a page not served over HTTPS — simply never shows the button.
 */
export default function useInstallPrompt() {
  const canInstall = useSyncExternalStore(
    subscribeInstallPrompt,
    canInstallApp,
    noStore,
  );

  const promptInstall = useCallback(() => takeInstallPrompt(), []);

  return { canInstall, promptInstall };
}
