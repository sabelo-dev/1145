import { useEffect, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Apple, Car, Check, Copy, Download, ShieldCheck, Smartphone, Store } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import SEO from "@/components/SEO";
import ShareAppsCard from "@/components/downloads/ShareAppsCard";
import { useAuth } from "@/contexts/AuthContext";
import { DOWNLOADABLE_APPS, type AppKey } from "@/config/appDownloads";
import { isNative } from "@/lib/native";
import { recalledReferralCode, rememberReferralCode } from "@/lib/referral";

// Every app carries the 1145 logo; a small badge tells them apart.
const badges: Record<AppKey, ReactNode> = {
  app: null,
  driver: <Car className="h-3.5 w-3.5" />,
  orders: <Store className="h-3.5 w-3.5" />,
};

/**
 * Direct downloads of the Android apps (APK) and the iOS TestFlight links,
 * plus each signed-in user's share link. Inside the store-installed apps the
 * download buttons are hidden: Google Play and the App Store do not allow an
 * app to offer installs from outside the store, so only sharing remains.
 */
export default function DownloadsPage() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [inviteCode, setInviteCode] = useState("");
  const [copied, setCopied] = useState(false);
  const native = isNative();

  useEffect(() => {
    rememberReferralCode(params.get("ref"));
    setInviteCode(params.get("ref")?.trim().toUpperCase() || recalledReferralCode());
  }, [params]);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // The code is on screen to type in by hand.
    }
  };

  return (
    <>
      <SEO
        title="Download the 1145 apps"
        description="Download 1145, 1145 Driver and 1145 Orders for Android, or join the iPhone beta on TestFlight."
      />
      <div className="container mx-auto max-w-4xl space-y-6 px-4 py-8">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold md:text-3xl">Get the 1145 apps</h1>
          <p className="text-muted-foreground">
            {native
              ? "Invite friends to the 1145 apps and earn UCoins when they join."
              : "Install directly on Android, or join the iPhone beta through TestFlight."}
          </p>
        </header>

        {inviteCode && !user && (
          <Card className="border-primary/40 bg-primary/5">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">A friend invited you</p>
                <p className="text-sm text-muted-foreground">
                  Install an app below, then enter this invite code when you sign up.
                </p>
              </div>
              <Button variant="outline" onClick={copyCode} className="font-mono">
                {inviteCode}
                {copied ? <Check className="ml-2 h-4 w-4" /> : <Copy className="ml-2 h-4 w-4" />}
              </Button>
            </CardContent>
          </Card>
        )}

        {!native && (
          <div className="grid gap-4 md:grid-cols-3">
            {DOWNLOADABLE_APPS.map((app) => (
              <Card key={app.key} className="flex flex-col">
                <CardHeader className="space-y-3">
                  <div className="relative h-14 w-14">
                    <img src="/logo-mark-96.png" srcSet="/logo-mark-96.png 1x, /logo-mark-192.png 2x" alt="" width={56} height={56} className="h-14 w-14" />
                    {badges[app.key] && (
                      <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground">
                        {badges[app.key]}
                      </span>
                    )}
                  </div>
                  <CardTitle className="text-lg">{app.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{app.description}</p>
                </CardHeader>
                <CardContent className="mt-auto space-y-2">
                  {app.apkUrl && (
                    <Button asChild className="w-full">
                      <a href={app.apkUrl} download>
                        <Download className="mr-2 h-4 w-4" /> Android (APK)
                      </a>
                    </Button>
                  )}
                  {app.testFlightUrl ? (
                    <Button asChild variant="outline" className="w-full">
                      <a href={app.testFlightUrl} target="_blank" rel="noopener noreferrer">
                        <Apple className="mr-2 h-4 w-4" /> iPhone (TestFlight)
                      </a>
                    </Button>
                  ) : (
                    <Button variant="outline" className="w-full" disabled>
                      <Apple className="mr-2 h-4 w-4" /> iPhone: coming soon
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {user ? (
          <ShareAppsCard userId={user.id} />
        ) : (
          <Card>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm">Sign in to get your own link and earn 200 UC for every friend who joins.</p>
              <Button asChild variant="outline">
                <Link to="/login">Sign in</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {!native && (
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Smartphone className="h-5 w-5 text-primary" /> Installing on Android
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                  <li>Tap <strong>Android (APK)</strong> and open the file when the download finishes.</li>
                  <li>If asked, allow your browser to <strong>install unknown apps</strong>.</li>
                  <li>Tap <strong>Install</strong>, then open the app and sign up.</li>
                </ol>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-5 w-5 text-primary" /> On iPhone
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Apple only allows apps from the App Store or TestFlight. Install Apple&apos;s free
                  <strong> TestFlight</strong> app first, then tap the iPhone button above to join the beta.
                </p>
                <p>
                  Prefer not to install anything? <Link to="/install" className="text-primary underline">Add 1145 to your home screen</Link>.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
