import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import MerchantLoginForm from "@/components/auth/MerchantLoginForm";
import { useAuth } from "@/contexts/AuthContext";
import { useFrameBreakout } from "@/hooks/useFrameBreakout";
import { supabase } from "@/integrations/supabase/client";

const MerchantLoginPage: React.FC = () => {
  useFrameBreakout();
  const { user, isLoading, isMerchant, isAdmin } = useAuth();
  const [merchantRedirect, setMerchantRedirect] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const checkOnboarding = async () => {
      if (!user || !(isMerchant || user.role === "vendor")) return;
      setChecking(true);
      const { data: vendor } = await supabase
        .from("vendors")
        .select("onboarding_status")
        .eq("user_id", user.id)
        .maybeSingle();
      setMerchantRedirect(
        vendor && vendor.onboarding_status !== "ACTIVE"
          ? "/merchant/onboarding"
          : "/merchant/dashboard"
      );
      setChecking(false);
    };
    checkOnboarding();
  }, [user, isMerchant]);

  if (isLoading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    if (isMerchant || user.role === "vendor") {
      if (merchantRedirect) return <Navigate to={merchantRedirect} replace />;
      return null;
    }
    if (isAdmin) return <Navigate to="/admin/dashboard" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="text-center text-3xl font-extrabold text-gray-900">
          Merchant Login
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Access your merchant dashboard
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <MerchantLoginForm />
      </div>
    </div>
  );
};

export default MerchantLoginPage;
