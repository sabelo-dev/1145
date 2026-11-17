import React, { useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLogisticsAuth } from "../auth/LogisticsAuth";
import { FullScreenSpinner } from "../components/common";

const LoginPage: React.FC = () => {
  const { session, role, needsMfa, accounts, loading, signIn } = useLogisticsAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <FullScreenSpinner />;
  if (session && role) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from !== "/login" ? from : "/"} replace />;
  }
  if (session && needsMfa) return <Navigate to="/mfa" replace />;
  if (session && !role && accounts.length) return <Navigate to="/portal" replace />;
  if (session && !role) return <Navigate to="/no-access" replace />;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex flex-col justify-between bg-primary text-primary-foreground p-10">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-primary-foreground text-primary grid place-items-center text-xs font-bold">LX</div>
          <span className="font-semibold">1145 Logistics</span>
        </div>
        <div className="max-w-md">
          <h2 className="text-3xl font-semibold leading-tight">Every parcel, route and driver in one place.</h2>
          <p className="mt-3 text-primary-foreground/80">
            Plan multi-stop routes, dispatch to the nearest driver, run hubs and keep every delivery on its promise.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/60">© LSI · 1145 Logistics</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5">
          <div>
            <h1 className="text-2xl font-semibold">Sign in</h1>
            <p className="text-sm text-muted-foreground mt-1">Use your 1145 account. Access is granted by your operations owner.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Tracking a parcel?{" "}
            <Link to="/track" className="text-primary underline-offset-4 hover:underline">
              Track it here
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
