import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import LoginForm from "@/components/auth/LoginForm";
import { useAuth } from "@/contexts/AuthContext";
import { useFrameBreakout } from "@/hooks/useFrameBreakout";
import { supabase } from "@/integrations/supabase/client";

const LoginPage: React.FC = () => {
  useFrameBreakout();
  const { user, isLoading, isAdmin, isMerchant, isDriver, isInfluencer } = useAuth();
  const [merchantRedirect, setMerchantRedirect] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const checkOnboarding = async () => {
      if (!user || !isMerchant || isAdmin || isInfluencer || isDriver) return;
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
  }, [user, isMerchant, isAdmin, isInfluencer, isDriver]);

  // Show loading while auth is initializing
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

  // If user is already logged in, redirect to their role-specific dashboard
  if (user) {
    if (isAdmin) return <Navigate to="/admin/dashboard" replace />;
    if (isInfluencer) return <Navigate to="/influencer/dashboard" replace />;
    if (isDriver) return <Navigate to="/driver/dashboard" replace />;
    if (isMerchant) {
      if (merchantRedirect) return <Navigate to={merchantRedirect} replace />;
      return null;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="text-center text-3xl font-extrabold text-gray-900">Login to 1145</h2>
        <p className="mt-2 text-center text-sm text-gray-600">Access your account to shop and manage your orders</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <LoginForm />
      </div>
    </div>
  );
};

export default LoginPage;
