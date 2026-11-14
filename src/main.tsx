import './index.css';
import { captureAttribution } from './lib/attribution';

const root = document.getElementById('root')!;

// Remember which ad, post or site first brought this visitor (lib/attribution).
captureAttribution();

// The ad landing page (/start) boots on its own, without the app shell, so
// visitors on mobile data see its call to action first. Keep the path in step
// with src/brand/loader.html and the /start route in App.tsx.
if (/^\/start\/?$/.test(window.location.pathname)) {
  import('./landing').then(({ mountLanding }) => mountLanding(root));
} else {
  import('./bootApp').then(({ mountApp }) => mountApp(root));
}
