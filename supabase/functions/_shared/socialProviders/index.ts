// Provider registry. Adding a new social platform means dropping a file next
// to this one that satisfies SocialProvider and registering it below.

import { metaFacebookProvider } from "./meta_facebook.ts";
import { metaInstagramProvider } from "./meta_instagram.ts";
import { tiktokProvider } from "./tiktok.ts";

export interface OAuthAuthUrlInput {
  state: string;
  codeChallenge?: string;
  redirectUri: string;
  scopes: string[];
  extraParams?: Record<string, string>;
}

export interface OAuthCodeExchangeInput {
  code: string;
  codeVerifier?: string;
  redirectUri: string;
}

export interface OAuthTokenBundle {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  expiresIn?: number;      // seconds
  scope?: string;
  raw: Record<string, unknown>;
}

export interface ProviderProfile {
  providerAccountId: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  accountType?: string;
  raw: Record<string, unknown>;
}

export interface PublishInput {
  caption?: string;
  mediaUrls?: string[];
  hashtags?: string[];
  metadata?: Record<string, unknown>;
}

export interface PublishResult {
  providerPostId: string;
  raw: Record<string, unknown>;
}

export interface WebhookVerification {
  valid: boolean;
  eventId?: string;
  eventType?: string;
  reason?: string;
}

export interface SocialProvider {
  /** Unique key matching social_connections.provider. */
  id: string;
  displayName: string;
  /** Scopes the app must be granted before a connection can go to `connected`. */
  requiredScopes: string[];
  /** Additional optional scopes that unlock features. */
  optionalScopes?: string[];
  /** True when the provider mandates PKCE. */
  usesPkce: boolean;

  buildAuthUrl(input: OAuthAuthUrlInput): string;

  exchangeCode(input: OAuthCodeExchangeInput): Promise<OAuthTokenBundle>;

  refresh?(refreshToken: string): Promise<OAuthTokenBundle>;

  readProfile(accessToken: string): Promise<ProviderProfile>;

  /**
   * A cheap capability probe run during end-to-end validation to prove
   * publishing is granted, WITHOUT creating public content.
   */
  probePublishCapability?(accessToken: string, profile: ProviderProfile): Promise<{
    supported: boolean;
    reason?: string;
    details?: Record<string, unknown>;
  }>;

  publish?(input: PublishInput & { accessToken: string; profile: ProviderProfile }): Promise<PublishResult>;

  verifyWebhook?(headers: Headers, rawBody: string): Promise<WebhookVerification>;
}

const REGISTRY: Record<string, SocialProvider> = {
  [metaFacebookProvider.id]: metaFacebookProvider,
  [metaInstagramProvider.id]: metaInstagramProvider,
  [tiktokProvider.id]: tiktokProvider,
};

export function getProvider(id: string): SocialProvider {
  const p = REGISTRY[id];
  if (!p) throw new Error(`Unknown social provider: ${id}`);
  return p;
}

export function listProviders(): SocialProvider[] {
  return Object.values(REGISTRY);
}
