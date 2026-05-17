import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import App from './App.tsx';
import './index.css';
import { initNative } from './lib/native';
import { registerServiceWorker } from './lib/registerSW';

createRoot(document.getElementById('root')!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);

// Native + PWA bootstrap (both no-op when not applicable)
initNative();
registerServiceWorker();
