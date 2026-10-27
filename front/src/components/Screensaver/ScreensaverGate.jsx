import { lazy, Suspense } from "react";
import { useSelector } from "react-redux";

import { selectDisableScreensavers } from "../../Redux/reducers/interfaceSettingsSlice";
import { isSnowSeason, SNOW_IDLE_MS } from "./screensaverConfig";

const SnowScreensaver = lazy(() => import("./SnowScreensaver"));

export default function ScreensaverGate() {
  const disabled = useSelector(selectDisableScreensavers);
  if (disabled || !isSnowSeason()) return null;

  return (
    <Suspense fallback={null}>
      <SnowScreensaver idleMs={SNOW_IDLE_MS} />
    </Suspense>
  );
}
