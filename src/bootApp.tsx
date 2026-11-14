import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import App from './App.tsx';
import { initNative } from './lib/native';
import { registerServiceWorker } from './lib/registerSW';

/** The full app: every route except the ad landing page (see main.tsx). */
export function mountApp(root: HTMLElement) {
  createRoot(root).render(
    <HelmetProvider>
      <App />
    </HelmetProvider>
  );

  // Native + PWA bootstrap (both no-op when not applicable)
  initNative();
  registerServiceWorker();
}
