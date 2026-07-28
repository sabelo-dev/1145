import React from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useFrameBreakout } from "@/hooks/useFrameBreakout";
import AuthShell from "@/components/auth/AuthShell";
import OAuthButtons from "@/components/auth/OAuthButtons";

const LoginPage: React.FC = () => {
  useFrameBreakout();
  const { user, isLoading, isAdmin, isMerchant, isDriver, isInfluencer } = useAuth();

  if (isLoading) {
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
    if (isAdmin) return <Navigate to="/admin/dashboard" replace />;
    if (isInfluencer) return <Navigate to="/influencer/dashboard" replace />;
    if (isDriver) return <Navigate to="/driver/dashboard" replace />;
    if (isMerchant) return <Navigate to="/merchant/dashboard" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to 1145 with your Google or GitHub account"
      footer={
        <span className="text-muted-foreground">
          New to 1145?{" "}
          <Link to="/register" className="font-medium text-foreground hover:underline">
            Create an account
          </Link>
        </span>
      }
    >
      <OAuthButtons mode="login" />
      <p className="mt-6 text-xs text-center text-muted-foreground">
        By continuing you agree to our Terms of Service and Privacy Policy.
      </p>
    </AuthShell>
  );
};

export default LoginPage;
