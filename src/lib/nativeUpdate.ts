/**
 * Update checks for the Android apps installed from 1145.io/downloads.
 *
 * The web code ships inside the APK, so a new release only reaches a phone as
 * a new APK. Each release publishes `versions.json` next to the APKs in the
 * app-downloads bucket (scripts/android-versions.mjs). The app compares its
 * installed versionCode with it and offers the new APK; Android installs it
 * over the old one, keeping the user's data, because every release is signed
 * with the same key and has a higher versionCode (MOBILE_RELEASE.md §10).
 */
import { Capacitor } from '@capacitor/core';
import { APK_BASE, DOWNLOADABLE_APPS, type AppKey } from '@/config/appDownloads';
import { compareRelease, type ReleaseInfo } from '@/lib/appRelease';

export const NATIVE_UPDATE_EVENT = 'native:update-available';

export type VersionManifest = Partial<Record<AppKey, ReleaseInfo>>;

export interface NativeUpdate {
  app: AppKey;
  appName: string;
  installedVersion: string;
  latest: ReleaseInfo;
  required: boolean;
  apkUrl: string;
}

const APP_KEYS: Record<string, AppKey> = {
  'io.lifestyle1145.app': 'app',
  'io.lifestyle1145.driver': 'driver',
  'io.lifestyle1145.orders': 'orders',
};

const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
let pending: NativeUpdate | null = null;
let started = false;

/** The update found by the last check, if any. */
export const getNativeUpdate = () => pending;

async function check() {
  const { App } = await import('@capacitor/app');
  const info = await App.getInfo();
  const app = APP_KEYS[info.id];
  const download = DOWNLOADABLE_APPS.find((a) => a.key === app);
  if (!app || !download?.apkUrl) return;

  // The query string skips any cached copy, so a release is seen at once.
  const res = await fetch(`${APK_BASE}/versions.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) return;
  const latest = ((await res.json()) as VersionManifest)[app];
  const result = compareRelease(Number(info.build), latest);
  if (!result || !latest) return;
  if (pending?.latest.versionCode === latest.versionCode && pending.required === result.required) return;

  pending = {
    app,
    appName: download.name,
    installedVersion: info.version,
    latest,
    required: result.required,
    apkUrl: download.apkUrl,
  };
  window.dispatchEvent(new Event(NATIVE_UPDATE_EVENT));
}

const safeCheck = () => check().catch((e) => console.warn('[update] check failed', e));

/**
 * Checks on launch, whenever the app comes back to the foreground, and every
 * few hours while it stays open. Android only: iPhone builds update through
 * TestFlight or the App Store.
 */
export async function startNativeUpdateChecks() {
  if (started || Capacitor.getPlatform() !== 'android') return;
  started = true;
  void safeCheck();
  const { App } = await import('@capacitor/app');
  await App.addListener('appStateChange', ({ isActive }) => { if (isActive) void safeCheck(); });
  setInterval(() => void safeCheck(), CHECK_EVERY_MS);
}

/** Opens the APK in the browser; Android then offers to install it over this app. */
export async function downloadNativeUpdate(update: NativeUpdate) {
  const { Browser } = await import('@capacitor/browser');
  await Browser.open({ url: `${update.apkUrl}?v=${update.latest.versionCode}` });
}
