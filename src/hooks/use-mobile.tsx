import * as React from "react";

// Breakpoints aligned with Tailwind defaults
export const BREAKPOINTS = {
  mobile: 768,   // < 768px  -> mobile
  tablet: 1024,  // 768-1023 -> tablet
} as const;

type Device = "mobile" | "tablet" | "desktop";

const getDevice = (width: number): Device => {
  if (width < BREAKPOINTS.mobile) return "mobile";
  if (width < BREAKPOINTS.tablet) return "tablet";
  return "desktop";
};

/**
 * Subscribes to viewport changes via matchMedia (more efficient than resize)
 * and returns the current device classification. SSR-safe.
 */
export function useDevice(): Device {
  const subscribe = React.useCallback((cb: () => void) => {
    if (typeof window === "undefined") return () => {};
    const mqls = [
      window.matchMedia(`(max-width: ${BREAKPOINTS.mobile - 1}px)`),
      window.matchMedia(
        `(min-width: ${BREAKPOINTS.mobile}px) and (max-width: ${BREAKPOINTS.tablet - 1}px)`,
      ),
    ];
    mqls.forEach((m) => m.addEventListener("change", cb));
    // Also listen to orientation changes for mobile devices
    window.addEventListener("orientationchange", cb);
    return () => {
      mqls.forEach((m) => m.removeEventListener("change", cb));
      window.removeEventListener("orientationchange", cb);
    };
  }, []);

  const getSnapshot = React.useCallback(() => {
    if (typeof window === "undefined") return "desktop" as Device;
    return getDevice(window.innerWidth);
  }, []);

  const getServerSnapshot = React.useCallback(() => "desktop" as Device, []);

  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useIsMobile(): boolean {
  return useDevice() === "mobile";
}

export function useIsTablet(): boolean {
  return useDevice() === "tablet";
}

export function useIsDesktop(): boolean {
  return useDevice() === "desktop";
}

// Backward compatibility
export const useMobile = () => {
  const isMobile = useIsMobile();
  return { isMobile };
};
