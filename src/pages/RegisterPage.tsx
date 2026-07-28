import React from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useFrameBreakout } from "@/hooks/useFrameBreakout";
import AuthShell from "@/components/auth/AuthShell";
import OAuthButtons from "@/components/auth/OAuthButtons";

const RegisterPage: React.FC = () => {
  useFrameBreakout();
  const { user } = useAuth();

  if (user) return <Navigate to="/" replace />;

  return (
    <AuthShell
      title="Create your account"
      subtitle="Join 1145 Lifestyle with a single click"
      footer={
        <span className="text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-foreground hover:underline">
            Sign in
          </Link>
        </span>
      }
    >
      <OAuthButtons mode="register" />
      <p className="mt-6 text-xs text-center text-muted-foreground">
        By continuing you agree to our Terms of Service and Privacy Policy.
      </p>
    </AuthShell>
  );
};

export default RegisterPage;
