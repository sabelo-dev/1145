import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { LogisticsRole } from "../lib/db";

export interface PortalAccount {
  id: string;
  name: string;
  role: "admin" | "user";
  status: "active" | "on_hold" | "closed";
}

interface AccessStatus {
  role: LogisticsRole | null;
  member_role: LogisticsRole | null;
  mfa_required: boolean;
  aal: "aal1" | "aal2";
  idle_timeout_minutes: number;
  accounts?: PortalAccount[];
}

interface LogisticsAuthValue {
  session: Session | null;
  /** Effective role (null until MFA is satisfied when it's required). */
  role: LogisticsRole | null;
  /** Member of the team, but must complete a second factor first. */
  needsMfa: boolean;
  aal: "aal1" | "aal2";
  mfaRequired: boolean;
  /** Business accounts this user can use in the portal. */
  accounts: PortalAccount[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  /** True when the current role is one of `roles`. */
  can: (...roles: LogisticsRole[]) => boolean;
}

const Ctx = createContext<LogisticsAuthValue | undefined>(undefined);
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "scroll", "touchstart"] as const;

export const LogisticsAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AccessStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const lastActivity = useRef(Date.now());

  const loadStatus = useCallback(async (s: Session | null) => {
    if (!s) {
      setStatus(null);
      return;
    }
    const { data, error } = await supabase.rpc("logistics_access_status" as never);
    if (!error && data) {
      setStatus(data as unknown as AccessStatus);
      return;
    }
    // Backend without the security migration yet: fall back to the plain role.
    const { data: role } = await supabase.rpc("logistics_role" as never, { _user: s.user.id } as never);
    setStatus({ role: (role as LogisticsRole | null) ?? null, member_role: (role as LogisticsRole | null) ?? null, mfa_required: false, aal: "aal1", idle_timeout_minutes: 60 });
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadStatus(data.session);
      if (active) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      // MFA_CHALLENGE_VERIFIED upgrades the session to aal2.
      if (["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED", "MFA_CHALLENGE_VERIFIED"].includes(event)) {
        setLoading(true);
        loadStatus(s).finally(() => setLoading(false));
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadStatus]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    await loadStatus(data.session);
  }, [loadStatus]);

  // Idle sign-out for shared depot/hub terminals.
  useEffect(() => {
    if (!session || (!status?.member_role && !status?.accounts?.length)) return;
    const timeoutMs = (status.idle_timeout_minutes || 30) * 60_000;
    const bump = () => {
      lastActivity.current = Date.now();
    };
    bump();
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const id = window.setInterval(() => {
      if (Date.now() - lastActivity.current > timeoutMs) {
        toast({ title: "Signed out", description: `No activity for ${status.idle_timeout_minutes} minutes.` });
        signOut();
      }
    }, 30_000);
    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, bump));
      window.clearInterval(id);
    };
  }, [session, status?.member_role, status?.idle_timeout_minutes, signOut, toast]);

  const role = status?.role ?? null;
  const needsMfa = !role && !!status?.member_role && !!status?.mfa_required;
  const can = useCallback((...roles: LogisticsRole[]) => !!role && roles.includes(role), [role]);

  return (
    <Ctx.Provider
      value={{
        session,
        role,
        needsMfa,
        aal: status?.aal ?? "aal1",
        mfaRequired: !!status?.mfa_required,
        accounts: status?.accounts ?? [],
        loading,
        signIn,
        signOut,
        refresh,
        can,
      }}
    >
      {children}
    </Ctx.Provider>
  );
};

export function useLogisticsAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLogisticsAuth must be used inside LogisticsAuthProvider");
  return v;
}
