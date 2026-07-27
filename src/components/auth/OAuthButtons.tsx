import React, { useState } from "react";
import { Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getAppUrl } from "@/lib/appUrl";
import { toast } from "sonner";

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
    <path
      fill="#EA4335"
      d="M12 10.2v3.9h5.5c-.24 1.4-1.68 4.1-5.5 4.1-3.3 0-6-2.73-6-6.1s2.7-6.1 6-6.1c1.88 0 3.14.8 3.86 1.48l2.63-2.53C16.8 3.3 14.63 2.3 12 2.3 6.9 2.3 2.8 6.4 2.8 11.5S6.9 20.7 12 20.7c6.93 0 9.2-4.87 9.2-7.4 0-.5-.05-.87-.13-1.24H12z"
    />
  </svg>
);

interface Props {
  mode?: "login" | "register";
}

const OAuthButtons: React.FC<Props> = ({ mode = "login" }) => {
  const [loading, setLoading] = useState<"google" | "github" | null>(null);

  const handleOAuth = async (provider: "google" | "github") => {
    try {
      setLoading(provider);
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: getAppUrl("/") },
      });
      if (error) throw error;
    } catch (err: any) {
      toast.error(err?.message ?? `Failed to ${mode} with ${provider}`);
      setLoading(null);
    }
  };

  const verb = mode === "register" ? "Sign up" : "Continue";

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        className="w-full h-11 justify-center gap-3"
        onClick={() => handleOAuth("google")}
        disabled={loading !== null}
      >
        <GoogleIcon />
        <span>{loading === "google" ? "Redirecting…" : `${verb} with Google`}</span>
      </Button>

      <Button
        type="button"
        variant="outline"
        className="w-full h-11 justify-center gap-3"
        onClick={() => handleOAuth("github")}
        disabled={loading !== null}
      >
        <Github className="h-5 w-5" />
        <span>{loading === "github" ? "Redirecting…" : `${verb} with GitHub`}</span>
      </Button>
    </div>
  );
};

export default OAuthButtons;
