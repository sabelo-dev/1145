/**
 * Native bridge helpers for Capacitor.
 * Safe to import on web — every call no-ops when not running on a device.
 */
import { Capacitor } from '@capacitor/core';

export const isNative = () => Capacitor.isNativePlatform();
export const platform = () => Capacitor.getPlatform(); // 'ios' | 'android' | 'web'

/** Initialize native UI: status bar, splash, keyboard, back button. */
export async function initNative() {
  if (!isNative()) return;

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    // The page draws behind the status bar on Android 15+ (edge-to-edge), so
    // the icons must contrast with the app theme: dark icons on the light
    // theme, light icons on the dark one. Older Android paints the bar itself,
    // in the same colour as the page.
    const root = document.documentElement;
    const syncStatusBar = async () => {
      const dark = root.classList.contains('dark');
      await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
      if (platform() === 'android') {
        await StatusBar.setBackgroundColor({ color: dark ? '#0b1020' : '#ffffff' });
      }
    };
    await syncStatusBar();
    new MutationObserver(() => {
      syncStatusBar().catch(() => {});
    }).observe(root, { attributes: true, attributeFilter: ['class'] });
  } catch (e) {
    console.warn('[native] StatusBar init failed', e);
  }

  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide({ fadeOutDuration: 300 });
  } catch (e) {
    console.warn('[native] SplashScreen hide failed', e);
  }

  try {
    const { Keyboard } = await import('@capacitor/keyboard');
    Keyboard.addListener('keyboardWillShow', () => {
      document.body.classList.add('keyboard-open');
    });
    Keyboard.addListener('keyboardWillHide', () => {
      document.body.classList.remove('keyboard-open');
    });
  } catch {
    /* keyboard plugin optional */
  }

  // Links back into the app (io.lifestyle1145.app://app/...) after sign-in,
  // account connections and payments in the system browser.
  try {
    const { App } = await import('@capacitor/app');
    App.addListener('appUrlOpen', ({ url }) => {
      handleAppLink(url).catch((e) => console.warn('[native] app link failed', e));
    });
  } catch {
    /* app plugin optional */
  }

  // Native hardware back button -> browser history.back / exit on root
  try {
    const { App } = await import('@capacitor/app');
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack && window.history.length > 1) {
        window.history.back();
      } else {
        App.exitApp();
      }
    });
  } catch {
    /* app plugin optional */
  }
}

/** Light haptic feedback for taps; no-op on web. */
export async function hapticTap() {
  if (!isNative()) return;
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    /* ignore */
  }
}

/** Register for push notifications and return the device token. */
export async function registerPush(): Promise<string | null> {
  if (!isNative()) return null;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') return null;
    return new Promise((resolve) => {
      const sub = PushNotifications.addListener('registration', (t) => {
        sub.then((s) => s.remove());
        resolve(t.value);
      });
      PushNotifications.register();
    });
  } catch (e) {
    console.warn('[native] push register failed', e);
    return null;
  }
}

/** In-app navigation from outside React (BrowserRouter listens to popstate). */
export function navigateInApp(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/**
 * Open a page in the system browser (Custom Tabs / SFSafariViewController).
 * Google and Facebook block sign-in inside an app's own web view, and
 * payment pages belong in the browser too. On the web this is a normal
 * navigation.
 */
export async function openExternal(url: string) {
  if (!isNative()) {
    window.location.href = url;
    return;
  }
  const { Browser } = await import('@capacitor/browser');
  await Browser.open({ url, presentationStyle: 'popover' });
}

/**
 * io.lifestyle1145.app://app/<path>?<query>#<hash>
 *  - /auth/callback: Supabase sign-in result (tokens in the hash, or a PKCE
 *    code) — create the session, then show /auth/callback to route by role.
 *  - anything else: open that page in the app.
 */
async function handleAppLink(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return;
  }
  // "io.lifestyle1145.app://app/wallet" -> host "app", pathname "/wallet"
  const path = parsed.host === 'app' ? parsed.pathname || '/' : `/${parsed.host}${parsed.pathname}`;

  try {
    const { Browser } = await import('@capacitor/browser');
    await Browser.close();
  } catch {
    /* already closed (Android closes Custom Tabs itself) */
  }

  if (path === '/auth/callback') {
    const { supabase } = await import('@/integrations/supabase/client');
    const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''));
    const query = parsed.searchParams;
    const accessToken = hash.get('access_token');
    const refreshToken = hash.get('refresh_token');
    const code = query.get('code');
    const error = hash.get('error_description') || query.get('error_description') || hash.get('error') || query.get('error');

    if (accessToken && refreshToken) {
      await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    } else if (code) {
      await supabase.auth.exchangeCodeForSession(code);
    }

    const next = query.get('next');
    const params = new URLSearchParams();
    if (next) params.set('next', next);
    if (error) params.set('error_description', error);
    navigateInApp(`/auth/callback${params.toString() ? `?${params}` : ''}`);
    return;
  }

  navigateInApp(`${path}${parsed.search}${parsed.hash}`);
}
