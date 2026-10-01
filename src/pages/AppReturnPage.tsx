import React, { useEffect, useMemo } from "react";
import { Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { appDeepLink } from "@/lib/appUrl";

// Only same-site paths (never //host or absolute URLs).
const safePath = (value: string | null) =>
  value && value.startsWith("/") && !value.startsWith("//") ? value : "/";

/**
 * PayFast (and other browser flows started from the iOS / Android app)
 * return here, in the system browser. Hand the user back to the app at the
 * same page; offer a button in case the browser blocks the automatic switch.
 */
const AppReturnPage: React.FC = () => {
  const target = useMemo(() => {
    const to = safePath(new URLSearchParams(window.location.search).get("to"));
    return { to, link: appDeepLink(to) };
  }, []);

  useEffect(() => {
    window.location.href = target.link;
  }, [target]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
      <Smartphone className="h-10 w-10 text-primary" />
      <h1 className="text-xl font-semibold">Back to the 1145 app</h1>
      <p className="text-muted-foreground max-w-sm">If the app didn't open by itself, tap the button below.</p>
      <Button asChild>
        <a href={target.link}>Open the 1145 app</a>
      </Button>
      <a href={target.to} className="text-sm text-muted-foreground underline">Continue on the website instead</a>
    </div>
  );
};

export default AppReturnPage;
