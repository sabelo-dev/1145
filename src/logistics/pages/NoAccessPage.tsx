import React from "react";
import { Navigate } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLogisticsAuth } from "../auth/LogisticsAuth";
import { FullScreenSpinner } from "../components/common";

const NoAccessPage: React.FC = () => {
  const { session, role, needsMfa, accounts, loading, signOut } = useLogisticsAuth();
  if (loading) return <FullScreenSpinner />;
  if (!session) return <Navigate to="/login" replace />;
  if (role) return <Navigate to="/" replace />;
  if (needsMfa) return <Navigate to="/mfa" replace />;
  if (accounts.length) return <Navigate to="/portal" replace />;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md text-center">
        <ShieldAlert className="h-10 w-10 mx-auto text-muted-foreground" />
        <h1 className="mt-4 text-xl font-semibold">No logistics access yet</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {session.user.email} is signed in but isn't a member of the 1145 Logistics team. Ask an operations owner to add
          you from the Team page.
        </p>
        <Button variant="outline" className="mt-6" onClick={signOut}>
          Sign in with another account
        </Button>
      </div>
    </div>
  );
};

export default NoAccessPage;
