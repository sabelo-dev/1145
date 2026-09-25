/**
 * Safe service-worker registration for PWA installs.
 * Skips registration in iframes and during local development to avoid
 * stale cached shells.
 */
import { Capacitor } from '@capacitor/core';

export const PWA_UPDATE_EVENT = 'pwa:need-refresh';
let pendingUpdate: (() => Promise<void>) | null = null;

/** Set once a new version is waiting; call it to activate the update and reload. */
export const getPendingUpdate = () => pendingUpdate;

export async function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  // Never register inside Capacitor native shell (it serves bundled assets directly)
  if (Capacitor.isNativePlatform()) return;

  const isInIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();

  const host = window.location.hostname;
  const isPreviewHost = host === 'localhost' || host === '127.0.0.1';

  if (isInIframe || isPreviewHost) {
    // Aggressively unregister any leftover SW from previous sessions
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    } catch {
      /* ignore */
    }
    return;
  }

  try {
    const { registerSW } = await import('virtual:pwa-register');
    const updateSW = registerSW({
      immediate: false,
      onNeedRefresh() {
        // Never reload on our own (it could interrupt a checkout); UpdatePrompt
        // shows an "Update" toast and calls this when the user is ready.
        pendingUpdate = () => updateSW(true);
        window.dispatchEvent(new Event(PWA_UPDATE_EVENT));
      },
      onRegisteredSW(_url, registration) {
        // Tabs left open for days still hear about new releases.
        if (registration) setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);
      },
      onOfflineReady() {
        console.info('[pwa] app is ready to work offline');
      },
      onRegisterError(error) {
        console.warn('[pwa] SW register error', error);
      },
    });
  } catch (e) {
    console.warn('[pwa] register failed', e);
  }
}
