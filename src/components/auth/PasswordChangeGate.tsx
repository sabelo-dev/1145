import React, { useEffect, useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MIN_LENGTH = 10;

/**
 * Accounts created by a team invitation start with a temporary password that
 * was emailed (user_metadata.must_change_password). Until the person chooses
 * their own, this covers the whole app, so the emailed password is good for
 * one sign-in only.
 */
const PasswordChangeGate: React.FC = () => {
  const [required, setRequired] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const check = (user: { email?: string; user_metadata?: Record<string, unknown> } | null | undefined) => {
      setRequired(user?.user_metadata?.must_change_password === true);
      setEmail(user?.email ?? "");
    };
    supabase.auth.getSession().then(({ data }) => check(data.session?.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => check(session?.user));
    return () => subscription.unsubscribe();
  }, []);

  if (!required) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_LENGTH) return setError(`Use at least ${MIN_LENGTH} characters.`);
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return setError("Use both letters and numbers.");
    if (password !== confirm) return setError("The two passwords don't match.");

    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password, data: { must_change_password: false } });
    setSaving(false);
    if (updateError) {
      setError(/different from the old|same/i.test(updateError.message)
        ? "Choose a password different from the temporary one."
        : updateError.message);
      return;
    }
    setRequired(false);
    toast.success("Password saved. Welcome to the team!");
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 p-4 backdrop-blur" role="dialog" aria-modal="true" aria-labelledby="password-gate-title">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle id="password-gate-title" className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" /> Set your password
          </CardTitle>
          <CardDescription>
            You signed in with a temporary password that was emailed to you. Choose your own to continue{email ? ` as ${email}` : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={save}>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input id="new-password" type="password" autoComplete="new-password" autoFocus value={password}
                onChange={(e) => setPassword(e.target.value)} className="h-11" />
              <p className="text-xs text-muted-foreground">At least {MIN_LENGTH} characters, with letters and numbers.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input id="confirm-password" type="password" autoComplete="new-password" value={confirm}
                onChange={(e) => setConfirm(e.target.value)} className="h-11" />
            </div>
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            <Button type="submit" className="h-11 w-full" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save password and continue"}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => supabase.auth.signOut()}>
              Sign out
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default PasswordChangeGate;
