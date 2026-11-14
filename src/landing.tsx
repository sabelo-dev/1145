import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import { BrowserRouter } from 'react-router-dom';
import StartPage from './pages/StartPage';
import { plausiblePageview } from './lib/plausible';

/**
 * The ad landing page on its own (see main.tsx): no auth, data client,
 * query cache or app shell, so it paints on mobile data as soon as React does.
 * Its links are plain page loads into the full app. The service worker is not
 * registered here, so a first visit from an ad does not also download the
 * whole offline cache.
 */
export function mountLanding(root: HTMLElement) {
  createRoot(root).render(
    <HelmetProvider>
      <BrowserRouter>
        <StartPage />
      </BrowserRouter>
    </HelmetProvider>
  );
  plausiblePageview();
}
