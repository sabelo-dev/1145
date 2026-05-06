import React from "react";
import { Navigate } from "react-router-dom";
import RegisterForm from "@/components/auth/RegisterForm";
import { useAuth } from "@/contexts/AuthContext";
import { useFrameBreakout } from "@/hooks/useFrameBreakout";

const RegisterPage: React.FC = () => {
  useFrameBreakout();
  const { user } = useAuth();

  // If user is already logged in, redirect to homepage
  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="text-center text-3xl font-extrabold text-gray-900">Create an Account</h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Join 1145 Lifestyle to start shopping and tracking your orders
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <RegisterForm />
      </div>
    </div>
  );
};

export default RegisterPage;
