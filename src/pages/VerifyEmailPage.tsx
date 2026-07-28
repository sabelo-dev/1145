import React, { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useFrameBreakout } from "@/hooks/useFrameBreakout";
import AuthShell from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const VerifyEmailPage: React.FC = () => {
  useFrameBreakout();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, verifyEmailOtp, resendVerification } = useAuth();

  const [email, setEmail] = useState(params.get("email") || user?.email || "");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  if (user?.emailVerified) return <Navigate to="/dashboard" replace />;

  const onVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || code.length < 6) return;
    setSubmitting(true);
    try {
      await verifyEmailOtp(email.trim(), code.trim());
      navigate("/login", { replace: true });
    } catch {
      /* toast handled */
    } finally {
      setSubmitting(false);
    }
  };

  const onResend = async () => {
    if (!email || cooldown > 0) return;
    setResending(true);
    try {
      await resendVerification(email.trim());
      setCooldown(45);
    } catch {
      /* toast handled */
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthShell
      title="Verify your email"
      subtitle="Enter the 6-digit code we sent to your inbox"
      footer={
        <span className="text-muted-foreground">
          Wrong email?{" "}
          <Link to="/register" className="font-medium text-foreground hover:underline">
            Start over
          </Link>
        </span>
      }
    >
      <form onSubmit={onVerify} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="code">Confirmation code</Label>
          <Input
            id="code"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="text-center text-2xl tracking-[0.4em] font-mono"
            required
          />
        </div>
        <Button type="submit" className="w-full h-11" disabled={submitting || code.length < 6}>
          {submitting ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</>
          ) : (
            "Verify email"
          )}
        </Button>
      </form>

      <div className="mt-4 text-center text-sm">
        <button
          type="button"
          onClick={onResend}
          disabled={resending || cooldown > 0 || !email}
          className="text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          {cooldown > 0
            ? `Resend code in ${cooldown}s`
            : resending
            ? "Sending..."
            : "Didn't get it? Resend code"}
        </button>
      </div>
    </AuthShell>
  );
};

export default VerifyEmailPage;
