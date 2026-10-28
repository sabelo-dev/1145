// The apps offered on /downloads. Android APKs live in the public
// app-downloads storage bucket (see MOBILE_RELEASE.md, "Direct downloads");
// iOS installs go through TestFlight, because Apple does not allow installing
// apps straight from a website. An app without a link shows "Coming soon".

export type AppKey = "app" | "driver" | "orders";

export interface DownloadableApp {
  key: AppKey;
  name: string;
  description: string;
  apkUrl: string | null;
  testFlightUrl: string | null;
}

export const APK_BASE =
  import.meta.env.VITE_APP_DOWNLOADS_URL ||
  "https://hipomusjocacncjsvgfa.supabase.co/storage/v1/object/public/app-downloads";

const env = (value: string | undefined) => value?.trim() || null;

export const DOWNLOADABLE_APPS: DownloadableApp[] = [
  {
    key: "app",
    name: "1145",
    description: "Shop, order food, book rides, pay and earn UCoins.",
    apkUrl: `${APK_BASE}/1145.apk`,
    testFlightUrl: env(import.meta.env.VITE_TESTFLIGHT_URL),
  },
  {
    key: "driver",
    name: "1145 Driver",
    description: "For approved drivers: go online and take nearby trips and deliveries.",
    apkUrl: `${APK_BASE}/1145-driver.apk`,
    testFlightUrl: env(import.meta.env.VITE_DRIVER_TESTFLIGHT_URL),
  },
  {
    key: "orders",
    name: "1145 Orders",
    description: "For shops: the order console on its own, for a counter tablet.",
    apkUrl: `${APK_BASE}/1145-orders.apk`,
    testFlightUrl: null,
  },
];

/** The link a user shares; opening it remembers their referral code. */
export const appDownloadLink = (code: string) =>
  `https://1145.io/downloads?ref=${encodeURIComponent(code)}`;
