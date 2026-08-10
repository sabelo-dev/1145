import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Renders the consumer dashboard only for consumer accounts.
 * Any other role is sent to its own dashboard.
 */
const RoleDashboardRedirect: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading, isAdmin, isMerchant, isDriver, isInfluencer } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    if (isAdmin || user.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
    if (isInfluencer) return <Navigate to="/influencer/dashboard" replace />;
    if (isDriver || user.role === 'driver') return <Navigate to="/driver/dashboard" replace />;
    if (isMerchant || user.role === 'vendor') return <Navigate to="/merchant/dashboard" replace />;
  }

  return <>{children}</>;
};

export default RoleDashboardRedirect;
