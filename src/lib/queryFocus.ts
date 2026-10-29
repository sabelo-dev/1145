import { focusManager } from "@tanstack/react-query";
import { App } from "@capacitor/app";
import { isNative } from "@/lib/native";

/**
 * React Query refetches stale data when the page regains focus, which it
 * detects with the browser's visibilitychange event. Inside the Android and
 * iOS apps that event isn't reliably sent when the app comes back to the
 * foreground, so screens kept showing what they loaded before someone edited
 * an item elsewhere. In the apps, the Capacitor app state also drives focus.
 */
export function refetchOnAppResume() {
  if (!isNative()) return;
  focusManager.setEventListener((setFocused) => {
    const onVisibility = () => setFocused();
    window.addEventListener("visibilitychange", onVisibility, false);
    const handle = App.addListener("appStateChange", ({ isActive }) => setFocused(isActive));
    return () => {
      window.removeEventListener("visibilitychange", onVisibility);
      void handle.then((h) => h.remove());
    };
  });
}
