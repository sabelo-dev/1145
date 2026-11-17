import React, { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Spinner } from "./common";

type Stage = "loading" | "challenge" | "enroll" | "done";

/**
 * TOTP second factor (Google Authenticator, Microsoft Authenticator, 1Password…).
 * Verifies an existing factor, or enrols a new one, upgrading the session to AAL2.
 */
const MfaSetup: React.FC<{ onVerified: () => void; forceEnroll?: boolean }> = ({ onVerified, forceEnroll }) => {
  const [stage, setStage] = useState<Stage>("loading");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error: listErr } = await supabase.auth.mfa.listFactors();
      if (listErr) {
        setError(listErr.message);
        return;
      }
      const verified = data.totp.find((f) => f.status === "verified");
      if (verified && !forceEnroll) {
        setFactorId(verified.id);
        setStage("challenge");
        return;
      }
      // Drop abandoned, unverified enrolments before starting a new one.
      for (const f of data.all.filter((x) => x.status !== "verified")) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data: enrolled, error: enrollErr } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `1145 Logistics ${new Date().toISOString().slice(0, 10)}` });
      if (enrollErr || !enrolled) {
        setError(enrollErr?.message ?? "Could not start enrolment");
        return;
      }
      setFactorId(enrolled.id);
      setQr(enrolled.totp.qr_code);
      setSecret(enrolled.totp.secret);
      setStage("enroll");
    })();
  }, [forceEnroll]);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setError(null);
    const { error: vErr } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    setBusy(false);
    if (vErr) {
      setError(vErr.message.includes("Invalid") ? "That code isn't right. Check the time on your phone and try again." : vErr.message);
      setCode("");
      return;
    }
    setStage("done");
    onVerified();
  };

  if (error && stage === "loading") return <p className="text-sm text-destructive">{error}</p>;
  if (stage === "loading") return <Spinner />;
  if (stage === "done")
    return (
      <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
        <ShieldCheck className="h-4 w-4" /> Two-factor authentication is active for this session.
      </p>
    );

  return (
    <form onSubmit={verify} className="space-y-4">
      {stage === "enroll" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Scan this QR code with an authenticator app, then enter the 6-digit code it shows.</p>
          {qr && <img src={qr} alt="Authenticator QR code" className="h-44 w-44 rounded-lg border bg-white p-2" />}
          {secret && (
            <p className="text-xs text-muted-foreground">
              Can't scan? Enter this key: <span className="font-mono select-all break-all">{secret}</span>
            </p>
          )}
        </div>
      )}
      {stage === "challenge" && <p className="text-sm text-muted-foreground">Enter the 6-digit code from your authenticator app.</p>}
      <div className="space-y-1.5">
        <Label htmlFor="mfa-code">Code</Label>
        <Input
          id="mfa-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className="w-40 text-center text-lg tracking-[0.4em]"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy || code.length !== 6}>
        {busy ? "Verifying…" : stage === "enroll" ? "Turn on two-factor" : "Verify"}
      </Button>
    </form>
  );
};

export default MfaSetup;
