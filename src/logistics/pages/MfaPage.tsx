import React from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useLogisticsAuth } from "../auth/LogisticsAuth";
import { FullScreenSpinner } from "../components/common";
import MfaSetup from "../components/MfaSetup";

const MfaPage: React.FC = () => {
  const { session, role, needsMfa, loading, refresh, signOut } = useLogisticsAuth();
  const navigate = useNavigate();
  if (loading) return <FullScreenSpinner />;
  if (!session) return <Navigate to="/login" replace />;
  if (role) return <Navigate to="/" replace />;
  if (!needsMfa) return <Navigate to="/no-access" replace />;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <ShieldCheck className="h-8 w-8 text-primary" />
          <h1 className="mt-3 text-2xl font-semibold">Two-factor authentication</h1>
          <p className="text-sm text-muted-foreground mt-1">Your organisation requires a second factor to use 1145 Logistics.</p>
        </div>
        <MfaSetup
          onVerified={async () => {
            // A verified challenge issues a new AAL2 token; make sure we hold it.
            await supabase.auth.refreshSession();
            await refresh();
            navigate("/", { replace: true });
          }}
        />
        <Button variant="ghost" size="sm" onClick={signOut}>
          Sign out
        </Button>
      </div>
    </div>
  );
};

export default MfaPage;
