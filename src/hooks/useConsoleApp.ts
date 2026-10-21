import { useCallback, useEffect, useState } from "react";
import { isNative } from "@/lib/native";

/** The browser's install prompt (Chrome, Edge, Samsung Internet). */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const ORDERS_MANIFEST = "/orders.webmanifest";

/**
 * Makes /merchant/console behave as its own app ("1145 Orders"):
 *  - points the page at the console's web manifest, so installing from here
 *    gives a separate full-screen app that opens straight on the console;
 *  - keeps the screen awake while the console is visible (Screen Wake Lock);
 *  - exposes the browser's install prompt where there is one.
 * The native Android app keeps the screen on itself.
 */
export function useConsoleApp() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const installed = typeof window !== "undefined" && (
    window.matchMedia?.("(display-mode: standalone)").matches
    || window.matchMedia?.("(display-mode: fullscreen)").matches
    || (navigator as unknown as { standalone?: boolean }).standalone === true);

  // Use the console's manifest while this page is open, and restore the shop's afterwards.
  useEffect(() => {
    if (isNative()) return;
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]') ?? Object.assign(document.createElement("link"), { rel: "manifest" });
    if (!link.isConnected) document.head.appendChild(link);
    const previous = link.getAttribute("href");
    link.setAttribute("href", ORDERS_MANIFEST);

    const title = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
    const previousTitle = title?.content;
    if (title) title.content = "1145 Orders";

    return () => {
      if (previous) link.setAttribute("href", previous);
      else link.remove();
      if (title && previousTitle !== undefined) title.content = previousTitle;
    };
  }, []);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as InstallPromptEvent);
    };
    const onInstalled = () => setInstallEvent(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Keep the screen on; the lock is released when the tab is hidden, so take it again on return.
  useEffect(() => {
    if (isNative() || !("wakeLock" in navigator)) return;
    let lock: { release: () => Promise<void> } | null = null;
    const acquire = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        lock = await (navigator as unknown as { wakeLock: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> } })
          .wakeLock.request("screen");
      } catch {
        // Not allowed right now (battery saver, no user gesture yet); try again on the next visit.
      }
    };
    void acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      document.removeEventListener("visibilitychange", acquire);
      void lock?.release().catch(() => undefined);
    };
  }, []);

  const install = useCallback(async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice.catch(() => undefined);
    setInstallEvent(null);
  }, [installEvent]);

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  return {
    /** Show an Install button (the browser offered an install prompt). */
    canInstall: !!installEvent && !installed && !isNative(),
    /** iPad / iPhone have no prompt: show "Share → Add to Home Screen" instead. */
    showIosHint: isIos && !installed && !isNative(),
    install,
  };
}
