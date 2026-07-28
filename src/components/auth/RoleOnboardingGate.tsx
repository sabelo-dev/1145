import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PageLoader } from "@/components/ui/page-loader";

type Role = "vendor" | "driver" | "influencer";

interface Props {
  role: Role;
  children: React.ReactNode;
}

const ONBOARDING_PATH: Record<Role, string> = {
  vendor: "/merchant/onboarding",
  driver: "/driver/onboarding",
  influencer: "/influencer/onboarding",
};

/**
 * Gate wrapped around role-scoped dashboards. Ensures the user has finished
 * the role-specific onboarding flow before granting access.
 */
const RoleOnboardingGate: React.FC<Props> = ({ role, children }) => {
  const { user } = useAuth();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!user) return;
      setChecking(true);
      try {
        if (role === "vendor") {
          const { data } = await supabase
            .from("vendors")
            .select("status")
            .eq("user_id", user.id)
            .maybeSingle();
          if (active) setComplete(!!data && data.status !== "PENDING_PROFILE");
        } else if (role === "driver") {
          const { data } = await supabase
            .from("drivers")
            .select("onboarding_completed_at")
            .eq("user_id", user.id)
            .maybeSingle();
          if (active) setComplete(!!data?.onboarding_completed_at);
        } else if (role === "influencer") {
          const { data } = await supabase
            .from("influencer_profiles")
            .select("onboarding_completed_at")
            .eq("user_id", user.id)
            .maybeSingle();
          if (active) setComplete(!!data?.onboarding_completed_at);
        }
      } catch (e) {
        console.error("Onboarding gate check failed", e);
        if (active) setComplete(false);
      } finally {
        if (active) setChecking(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user, role]);

  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (checking) return <PageLoader />;
  if (!complete) return <Navigate to={ONBOARDING_PATH[role]} replace />;
  return <>{children}</>;
};

export default RoleOnboardingGate;
