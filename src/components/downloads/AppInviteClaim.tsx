import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import type { AppKey } from "@/config/appDownloads";
import { isNative } from "@/lib/native";
import { recalledReferralCode } from "@/lib/referral";
import { claimAppInstall } from "@/services/appInstallReferral";

const doneKey = (userId: string) => `1145_app_install_claim:${userId}`;

async function isDone(userId: string) {
  try {
    const { Preferences } = await import("@capacitor/preferences");
    return (await Preferences.get({ key: doneKey(userId) })).value === "1";
  } catch {
    return false;
  }
}

async function markDone(userId: string) {
  try {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.set({ key: doneKey(userId), value: "1" });
  } catch {
    // Asked again next launch; the server still pays only once.
  }
}

/**
 * Native apps only. After a new account's first sign-in, credits the friend
 * who invited them (claim_app_install). An account that signed up with a
 * referral code is credited silently; otherwise this asks for the friend's
 * invite code once.
 */
export default function AppInviteClaim({ app }: { app: AppKey }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isNative() || !userId) return;
    let cancelled = false;
    // Sign-up records its referral code just after the account is created;
    // give it a moment so those users are not asked for the code again.
    const timer = setTimeout(async () => {
      if (await isDone(userId)) return;
      try {
        const { status } = await claimAppInstall(app, recalledReferralCode() || undefined);
        if (cancelled) return;
        if (status === "no_referrer" || status === "invalid_code") setOpen(true);
        else await markDone(userId);
      } catch {
        // Offline or signed out mid-way: try again on the next launch.
      }
    }, 5000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [app, userId]);

  const close = () => {
    setOpen(false);
    if (userId) void markDone(userId);
  };

  const submit = async () => {
    if (!userId || !code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { status } = await claimAppInstall(app, code);
      if (status === "invalid_code") setError("That code was not found. Check it with your friend.");
      else if (status === "no_referrer") setError("Enter your friend's invite code.");
      else close();
    } catch {
      setError("Could not check the code. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Invited by a friend?</DialogTitle>
          <DialogDescription>
            Enter their invite code so they get their reward for bringing you to 1145.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Invite code"
          aria-label="Invite code"
          autoCapitalize="characters"
          maxLength={40}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={close} disabled={busy}>No code</Button>
          <Button onClick={submit} disabled={busy || !code.trim()}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
