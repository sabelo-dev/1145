const DEFAULT_PLATFORM_BASE_URL = "https://1145.io";
const PLATFORM_HOSTS = ["1145.io", "www.1145.io"];
const LOCAL_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0", "::1"];
const PREVIEW_HOST_SUFFIXES = [
  ".lovable.app",
  ".lovableproject.com",
  ".lovable.dev",
  ".app.github.dev",
  ".github.dev",
  ".githubpreview.dev",
];

type AppUrlEnv = Record<string, string | undefined>;

interface AppUrlOptions {
  hostname?: string;
  origin?: string;
  env?: AppUrlEnv;
}

const normalizeBaseUrl = (value?: string | null): string | null => {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    if (!trimmed.includes("://")) {
      const withProtocol = `https://${trimmed}`;
      const parsed = new URL(withProtocol);
      return `${parsed.protocol}//${parsed.host}`;
    }

    const parsed = new URL(trimmed);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
};

const isPlatformHost = (hostname: string) => {
  const normalizedHost = hostname.toLowerCase();
  return PLATFORM_HOSTS.some((host) => normalizedHost === host || normalizedHost.endsWith(`.${host}`));
};

const isPreviewHost = (hostname: string) => {
  const normalizedHost = hostname.toLowerCase();
  return (
    LOCAL_HOSTS.includes(normalizedHost) ||
    PREVIEW_HOST_SUFFIXES.some((suffix) => normalizedHost.endsWith(suffix))
  );
};

export const getPlatformBaseUrl = (options: AppUrlOptions = {}) => {
  const env = options.env ?? (typeof import.meta !== "undefined" ? import.meta.env : undefined);
  const explicitValue = [
    env?.VITE_PUBLIC_SITE_URL,
    env?.VITE_SITE_URL,
    env?.VITE_APP_URL,
    env?.SITE_URL,
  ].find(Boolean);

  const explicitBaseUrl = normalizeBaseUrl(explicitValue);
  if (explicitBaseUrl) {
    return explicitBaseUrl;
  }

  const hostname = options.hostname ?? (typeof window !== "undefined" ? window.location.hostname : "1145.io");
  const origin = options.origin ?? (typeof window !== "undefined" ? window.location.origin : DEFAULT_PLATFORM_BASE_URL);

  if (isPreviewHost(hostname)) {
    return normalizeBaseUrl(origin) ?? DEFAULT_PLATFORM_BASE_URL;
  }

  if (isPlatformHost(hostname)) {
    return DEFAULT_PLATFORM_BASE_URL;
  }

  return normalizeBaseUrl(origin) ?? DEFAULT_PLATFORM_BASE_URL;
};

export const getAppUrl = (path: string = "/", options: AppUrlOptions = {}) => {
  const baseUrl = getPlatformBaseUrl(options);
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  if (!path || path === "/") {
    return normalizedBaseUrl;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBaseUrl}${normalizedPath}`;
};
