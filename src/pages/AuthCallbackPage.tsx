import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

// Only follow same-site paths from ?next= (never //host or absolute URLs).
const safeNext = (value: string | null) =>
  value && value.startsWith("/") && !value.startsWith("//") ? value : null;

/**
 * Landing page for Google / GitHub / Facebook sign-in. Supabase returns here
 * with the session (or an error) in the URL; the auth client picks the session
 * up on load, and this page sends the user to the right dashboard.
 */
const AuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isLoading, isAdmin, isInfluencer, isDriver, isMerchant, isRestaurateur } = useAuth();

  // Read once on arrival: the auth client clears the URL after processing it.
  const [params] = useState(() => {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    return {
      error: query.get("error_description") || hash.get("error_description") || query.get("error") || hash.get("error"),
      next: safeNext(query.get("next")),
    };
  });
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), 10000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (params.error || isLoading || !user) return;

    const destination =
      params.next ||
      (isAdmin
        ? "/admin/dashboard"
        : isInfluencer
          ? "/influencer/dashboard"
          : isDriver
            ? "/driver/dashboard"
            : isMerchant
              ? "/merchant/dashboard"
              : isRestaurateur
                ? "/eatery/dashboard"
                : "/dashboard");

    navigate(destination, { replace: true });
  }, [params, isLoading, user, isAdmin, isInfluencer, isDriver, isMerchant, isRestaurateur, navigate]);

  const failure = params.error
    ? params.error.replace(/\+/g, " ")
    : !isLoading && !user && timedOut
      ? "We couldn't complete your sign-in. Please try again."
      : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm text-center space-y-4">
        {failure ? (
          <>
            <AlertCircle className="h-10 w-10 mx-auto text-destructive" />
            <h1 className="text-lg font-semibold">Sign-in failed</h1>
            <p className="text-sm text-muted-foreground">{failure}</p>
            <Button asChild className="w-full">
              <Link to="/login">Back to sign in</Link>
            </Button>
          </>
        ) : (
          <>
            <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Signing you in…</p>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallbackPage;
