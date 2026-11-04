import { useSelector } from "react-redux";

import { selectSendWithEnter } from "../Redux/reducers/userSettingsReducer";
import { useWindowSize } from "./useWindowSize";

/**
 * Resolve the effective submission mode. An explicit user choice wins;
 * otherwise Enter is used on desktop and Shift+Enter on mobile.
 */
export function useSendWithEnter(): boolean {
  const { isMobile } = useWindowSize();
  const setting = useSelector(selectSendWithEnter);
  return typeof setting === "boolean" ? setting : !isMobile;
}
