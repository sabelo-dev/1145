import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { appDeepLink, getAppUrl } from "@/lib/appUrl";
import { isNative, openExternal } from "@/lib/native";
import { toast } from "sonner";

// Official four-colour Google "G".
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

// Official Facebook "f".
const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true">
    <path
      fill="#1877F2"
      d="M24 12.07C24 5.41 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.62 23.1 24 18.1 24 12.07z"
    />
  </svg>
);

type Provider = "google" | "facebook";

const PROVIDERS: { id: Provider; label: string; Icon: React.FC }[] = [
  { id: "google", label: "Google", Icon: GoogleIcon },
  { id: "facebook", label: "Facebook", Icon: FacebookIcon },
];

// Where a new account should go after signing up with a given role.
const ROLE_ONBOARDING: Record<string, string> = {
  vendor: "/merchant/onboarding",
  driver: "/driver/onboarding",
  influencer: "/influencer/onboarding",
  restaurateur: "/eatery/dashboard",
};

/*
 * A provider that is not enabled in Supabase Auth sends the browser to a raw
 * JSON error page, so only show the providers the project actually has on.
 * The settings endpoint is public (publishable key only) and cached per load.
 */
let enabledProvidersRequest: Promise<Set<Provider> | null> | null = null;

const loadEnabledProviders = () => {
  enabledProvidersRequest ??= (async () => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return null;
    try {
      const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
      if (!res.ok) return null;
      const settings = await res.json();
      return new Set(PROVIDERS.map((p) => p.id).filter((id) => settings?.external?.[id] === true));
    } catch {
      return null;
    }
  })();
  return enabledProvidersRequest;
};

interface Props {
  mode?: "login" | "register";
  /** Role picked on the register form; OAuth sign-ups continue to its onboarding. */
  role?: string;
}

const OAuthButtons: React.FC<Props> = ({ mode = "login", role }) => {
  const [loading, setLoading] = useState<Provider | null>(null);
  // null = unknown (settings unavailable) → show every provider
  const [enabled, setEnabled] = useState<Set<Provider> | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    loadEnabledProviders().then((result) => {
      if (active) setEnabled(result);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleOAuth = async (provider: Provider) => {
    try {
      setLoading(provider);
      const next = mode === "register" && role ? ROLE_ONBOARDING[role] : undefined;
      const callback = next ? `/auth/callback?next=${encodeURIComponent(next)}` : "/auth/callback";
      // In the iOS / Android app Google and Facebook refuse to sign in inside
      // the app's web view: use the system browser and come back through the
      // app link (io.lifestyle1145.app://app/auth/callback, see lib/native.ts).
      const native = isNative();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: native ? appDeepLink(callback) : getAppUrl(callback),
          skipBrowserRedirect: native,
        },
      });
      if (error) throw error;
      if (native) {
        if (!data?.url) throw new Error("Could not start sign-in");
        await openExternal(data.url);
        setLoading(null);
      }
    } catch (err: any) {
      toast.error(err?.message ?? `Failed to ${mode} with ${provider}`);
      setLoading(null);
    }
  };

  const verb = mode === "register" ? "Sign up" : "Continue";

  // Avoid flashing buttons that will disappear once settings load.
  if (enabled === undefined) {
    return <div className="h-11" aria-hidden="true" />;
  }

  const visible = PROVIDERS.filter((p) => enabled === null || enabled.has(p.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-3">
      {visible.map(({ id, label, Icon }) => (
        <Button
          key={id}
          type="button"
          variant="outline"
          className="w-full h-11 justify-center gap-3"
          onClick={() => handleOAuth(id)}
          disabled={loading !== null}
        >
          <Icon />
          <span>{loading === id ? "Redirecting…" : `${verb} with ${label}`}</span>
        </Button>
      ))}
    </div>
  );
};

export default OAuthButtons;
