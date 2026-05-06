
import React from "react";
import { Navigate } from "react-router-dom";
import AdminLoginForm from "@/components/auth/AdminLoginForm";
import { useAuth } from "@/contexts/AuthContext";
import { useFrameBreakout } from "@/hooks/useFrameBreakout";

const AdminLoginPage: React.FC = () => {
  useFrameBreakout();
  const { user, isLoading, isAdmin } = useAuth();

  // Show loading while auth is initializing
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

  // If user is already logged in as admin, redirect to admin dashboard
  if (user && (user.role === "admin" || isAdmin)) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  // If user is logged in but not admin, redirect to home
  if (user && user.role !== "admin" && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="text-center text-3xl font-extrabold text-gray-900">
          Admin Login
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Access the admin dashboard
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <AdminLoginForm />
      </div>
    </div>
  );
};

export default AdminLoginPage;
