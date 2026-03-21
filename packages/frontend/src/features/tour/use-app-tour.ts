import { useCallback, useEffect } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { APP_TOUR_STEPS, TOUR_DONE_KEY } from "./app-tour";

export function useAppTour(autoStart = false) {
  const startTour = useCallback(() => {
    const driverObj = driver({
      showProgress: true,
      progressText: "{{current}} of {{total}}",
      animate: true,
      smoothScroll: true,
      allowClose: true,
      overlayColor: "#0B1929",
      overlayOpacity: 0.75,
      popoverClass: "tatva-tour-popover",
      doneBtnText: "Done ✓",
      closeBtnText: "Skip tour",
      nextBtnText: "Next →",
      prevBtnText: "← Back",
      steps: APP_TOUR_STEPS,
      onDestroyStarted: () => {
        localStorage.setItem(TOUR_DONE_KEY, "1");
        driverObj.destroy();
      },
    });
    driverObj.drive();
  }, []);

  useEffect(() => {
    if (!autoStart) return;
    const done = localStorage.getItem(TOUR_DONE_KEY);
    if (done) return;
    // Small delay so layout elements are fully mounted
    const timer = setTimeout(startTour, 800);
    return () => clearTimeout(timer);
  }, [autoStart, startTour]);

  return { startTour };
}
