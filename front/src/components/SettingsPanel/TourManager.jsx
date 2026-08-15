import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Joyride from "react-joyride-react-19";
import { useDispatch, useSelector } from "react-redux";
import { useWindowSize } from "../../hooks/useWindowSize";
import { useModal } from "../../modals/ModalContext";
import {
  closeTour,
  selectShowTour,
  toggleSettings,
  toggleSidebar,
} from "../../Redux/reducers/interfaceSettingsSlice";

export default function TourManager() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { openModal } = useModal();
  const { isMobile } = useWindowSize();

  const migrationData = useSelector((state) => state.migration_data) || {};
  const showTourSelected = useSelector(selectShowTour);
  const showTour = !isMobile && showTourSelected;

  const welcomeTimerRef = useRef(null);
  const [tourReady, setTourReady] = useState(false);
  const [runTour, setRunTour] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);

  const tourSteps = [
    {
      target: ".prompt-area",
      content: t("tour.prompt"),
      placement: "bottom",
      disableBeacon: true,
      styles: {
        tooltip: { border: "none", boxShadow: "none" },
        spotlight: { border: "none" },
      },
    },
    {
      target: ".model-selector",
      content: t("tour.model"),
      placement: "bottom",
      disableBeacon: false,
      styles: {
        tooltip: { border: "none", boxShadow: "none" },
        spotlight: { border: "none" },
      },
    },
    {
      target: ".sidebar-wrapper",
      content: t("tour.sidebar"),
      placement: "right",
      disableBeacon: true,
      styles: {
        tooltip: { border: "none", boxShadow: "none" },
        spotlight: { border: "none" },
      },
    },
    {
      target: ".settings-toggle",
      content: t("tour.settings"),
      placement: "left",
      disableBeacon: true,
      styles: {
        tooltip: { border: "none", boxShadow: "none" },
        spotlight: { border: "none" },
      },
    },
    {
      target: ".user-profile-button",
      content: t("tour.profile"),
      placement: "left",
      disableBeacon: true,
      styles: {
        tooltip: { border: "none", boxShadow: "none" },
        spotlight: { border: "none" },
      },
    },
    {
      target: ".interface-toggles",
      content: t("tour.interface"),
      placement: "top",
      disableBeacon: true,
      styles: {
        tooltip: { border: "none", boxShadow: "none" },
        spotlight: { border: "none" },
      },
    },
  ];

  // Handle tour actions
  const handleJoyrideCallback = useCallback(
    (data) => {
      const { action, index, status, type } = data;
      if (status === "finished" || status === "skipped") {
        dispatch(closeTour());
        setRunTour(false);
        setTourStepIndex(0); // Reset step index
      } else if (type === "step:after") {
        // Update step index and memory setting when navigating
        const newIndex = index + (action === "prev" ? -1 : 1);
        if (newIndex === 0) {
          dispatch(toggleSidebar(false));
          dispatch(toggleSettings(false));
        } else if (newIndex === 1) {
          dispatch(toggleSidebar(false));
          dispatch(toggleSettings(false));
        } else if (newIndex === 2) {
          dispatch(toggleSidebar(true));
          dispatch(toggleSettings(false));
        } else if (newIndex === 3) {
          dispatch(toggleSidebar(false));
          dispatch(toggleSettings(true));
        } else if (newIndex === 4) {
          dispatch(toggleSidebar(false));
          dispatch(toggleSettings(false));
        } else if (newIndex === 5) {
          dispatch(toggleSidebar(false));
          dispatch(toggleSettings(false));
        }
        setTimeout(() => {
          setTourStepIndex(newIndex);
        }, 500);
      }
    },
    [dispatch]
  );

  useEffect(() => {
    const id = requestAnimationFrame(() => setTourReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!tourReady) return;
    if (!showTour) {
      // if we go back to mobile, cancel pending timer and stop tour
      if (welcomeTimerRef.current) {
        clearTimeout(welcomeTimerRef.current);
        welcomeTimerRef.current = null;
      }
      setRunTour(false);
      return;
    }
    if (Object.keys(migrationData).length > 0) return;
    if (runTour) return; // already running

    const onRunTour = () => setRunTour(true);
    welcomeTimerRef.current = setTimeout(() => {
      openModal("welcome", { onRunTour });
    }, 200);

    return () => {
      if (welcomeTimerRef.current) {
        clearTimeout(welcomeTimerRef.current);
        welcomeTimerRef.current = null;
      }
    };
  }, [showTour, migrationData, openModal, runTour, tourReady]);

  const targetsReady =
    typeof window !== "undefined" &&
    Array.isArray(tourSteps) &&
    tourSteps.every((s) => s?.target && document.querySelector(s.target));

  if (!(showTour && tourReady && targetsReady)) return null;

  return (
    <Joyride
      steps={tourSteps}
      run={runTour}
      continuous
      showProgress
      showSkipButton
      disableOverlay={false}
      disableOverlayClose
      disableScrolling
      callback={handleJoyrideCallback}
      locale={{
        back: t("tour.back"),
        close: t("tour.close"),
        last: t("tour.last"),
        next: t("tour.next"),
        skip: t("tour.skip"),
      }}
      styles={{
        options: { primaryColor: "#009EE0", zIndex: 20000 },
        overlay: {
          backgroundColor: "rgba(0,0,0,0.75)",
          mixBlendMode: "normal",
        },
        spotlight: {
          borderRadius: 8,
          border: "2px solid #009EE0",
          backgroundColor: "transparent",
        },
        tooltip: {
          borderRadius: 12,
          fontSize: 16,
          fontFamily: "inherit",
          padding: 20,
          boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
          backgroundColor: "var(--tooltip-bg, #ffffff)",
          color: "var(--tooltip-text, #333333)",
        },
        tooltipContent: { padding: 0 },
        buttonNext: {
          backgroundColor: "#009EE0",
          fontSize: 14,
          fontWeight: 600,
          padding: "10px 20px",
          borderRadius: 8,
          border: "none",
        },
        buttonBack: {
          color: "#6b7280",
          fontSize: 14,
          padding: "10px 16px",
          marginRight: 12,
          border: "1px solid #d1d5db",
          borderRadius: 8,
          backgroundColor: "transparent",
        },
        buttonSkip: {
          color: "#6b7280",
          fontSize: 14,
          padding: "10px 16px",
          backgroundColor: "transparent",
          border: "none",
        },
      }}
    />
  );
}
