import React from "react";
import { Navigate } from "react-router-dom";
import MerchantLoginForm from "@/components/auth/MerchantLoginForm";
import { useAuth } from "@/contexts/AuthContext";

const MerchantLoginPage: React.FC = () => {
  const { user, isLoading, isMerchant } = useAuth();

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

  if (user && (user.role === "vendor" || isMerchant)) {
    return <Navigate to="/merchant/dashboard" replace />;
  }

  if (user && user.role !== "vendor" && !isMerchant) {
    return <Navigate to="/" replace />;
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
