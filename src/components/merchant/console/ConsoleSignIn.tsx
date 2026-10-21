import React, { useState } from "react";
import { Loader2, MonitorSmartphone } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Sign-in for the order console app. Owners and staff use their own 1145
 * account; the console then shows the stores that account can work in.
 * Errors are shown by AuthContext's toast.
 */
const ConsoleSignIn: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email.trim(), password);
    } catch {
      // shown by AuthContext
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f2a4d] p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <MonitorSmartphone className="mx-auto mb-2 h-10 w-10 text-primary" />
          <CardTitle className="text-2xl">1145 Orders</CardTitle>
          <CardDescription>Sign in with your 1145 account to run your store's orders.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="console-email">Email</Label>
              <Input id="console-email" type="email" autoComplete="username" required value={email}
                onChange={(e) => setEmail(e.target.value)} className="h-12 text-base" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="console-password">Password</Label>
              <Input id="console-password" type="password" autoComplete="current-password" required value={password}
                onChange={(e) => setPassword(e.target.value)} className="h-12 text-base" />
            </div>
            <Button type="submit" className="h-12 w-full text-base" disabled={busy}>
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConsoleSignIn;
