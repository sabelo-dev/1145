// The release manifest (versions.json in the app-downloads bucket), written by
// scripts/android-versions.mjs. No imports, so tests run it under plain Node.

export interface ReleaseInfo {
  versionCode: number;
  versionName: string;
  /** Installs below this must update before they can be used. */
  minVersionCode?: number;
  notes?: string;
}

/** Whether `latest` is newer than the installed versionCode, and if so whether it is required. */
export function compareRelease(installedCode: number, latest: ReleaseInfo | undefined) {
  if (!latest || !Number.isInteger(latest.versionCode) || !Number.isFinite(installedCode)) return null;
  if (latest.versionCode <= installedCode) return null;
  return { required: installedCode < (latest.minVersionCode ?? 0) };
}
