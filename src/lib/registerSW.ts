/**
 * Safe service-worker registration for PWA installs.
 * Skips registration in iframes (Lovable preview) and on preview hosts
 * to avoid stale cached shells during development.
 */
import { Capacitor } from '@capacitor/core';

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
  const isPreviewHost =
    host.includes('id-preview--') ||
    host.includes('lovableproject.com') ||
    host.includes('lovable.app');

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
    registerSW({
      immediate: true,
      onRegisterError(error) {
        console.warn('[pwa] SW register error', error);
      },
    });
  } catch (e) {
    console.warn('[pwa] register failed', e);
  }
}
