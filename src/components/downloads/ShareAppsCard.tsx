import { useEffect, useState } from "react";
import { Check, Copy, Gift, Loader2, Share2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { appDownloadLink } from "@/config/appDownloads";
import { isNative } from "@/lib/native";
import { getAppInstallStats, getMyReferralCode } from "@/services/appInstallReferral";

const REWARD = 200;

/** The signed-in user's app download link, with how many friends it brought in. */
export default function ShareAppsCard({ userId }: { userId: string }) {
  const { toast } = useToast();
  const [code, setCode] = useState<string | null>(null);
  const [stats, setStats] = useState<{ installs: number; earned: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMyReferralCode(userId)
      .then((c) => { if (!cancelled) setCode(c); })
      .catch(() => { if (!cancelled) setFailed(true); });
    getAppInstallStats()
      .then((s) => { if (!cancelled) setStats(s); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [userId]);

  const link = code ? appDownloadLink(code) : "";
  const text = `Get the 1145 apps and use my invite code ${code} when you sign up.`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ variant: "destructive", title: "Could not copy the link", description: "Select the link and copy it by hand." });
    }
  };

  const share = async () => {
    try {
      if (isNative()) {
        const { Share } = await import("@capacitor/share");
        await Share.share({ title: "Get the 1145 apps", text, url: link, dialogTitle: "Share the 1145 apps" });
        return;
      }
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "Get the 1145 apps", text, url: link });
        return;
      }
    } catch (error) {
      // Closing the share sheet is not an error worth reporting.
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (error instanceof Error && /cancel/i.test(error.message)) return;
    }
    await copy();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Gift className="h-5 w-5 text-primary" />
          Share the apps, earn {REWARD} UC
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Send friends your link. When a friend creates an account and signs in on any 1145 app for the
          first time, you earn {REWARD} UCoins. Once per friend and per phone.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {failed ? (
          <p className="text-sm text-destructive">Your link could not be loaded. Refresh the page to try again.</p>
        ) : !code ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your link...
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <Input readOnly value={link} aria-label="Your app download link" onFocus={(e) => e.currentTarget.select()} />
              <Button variant="outline" size="icon" onClick={copy} aria-label="Copy link">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <Button className="w-full" onClick={share}>
              <Share2 className="mr-2 h-4 w-4" /> Share link
            </Button>
            <p className="text-xs text-muted-foreground">
              Your invite code is <span className="font-mono font-semibold text-foreground">{code}</span>. Friends
              enter it in the app if they sign up without opening your link.
            </p>
          </>
        )}
        {stats && (
          <div className="grid grid-cols-2 gap-2 border-t pt-3 text-center">
            <div>
              <p className="text-xl font-semibold">{stats.installs}</p>
              <p className="text-xs text-muted-foreground">Friends on the app</p>
            </div>
            <div>
              <p className="text-xl font-semibold">{Number(stats.earned).toLocaleString()} UC</p>
              <p className="text-xs text-muted-foreground">Earned</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
