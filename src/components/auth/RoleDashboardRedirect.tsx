import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMerchantAccess } from '@/hooks/useMerchantAccess';

const Loading = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
      <p className="mt-2 text-muted-foreground">Loading...</p>
    </div>
  </div>
);

/**
 * Renders the consumer dashboard only for consumer accounts. Any other role is
 * sent to its own dashboard, by the same rules as the login page: admins,
 * influencers, drivers, merchants, restaurateurs, and store staff (managers,
 * operators and cashiers in someone else's store) to the 1145 Orders console.
 */
const RoleDashboardRedirect: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading, isAdmin, isMerchant, isDriver, isInfluencer, isRestaurateur } = useAuth();
  const { stores: staffStores, isLoading: staffLoading } = useMerchantAccess();

  if (isLoading) return <Loading />;

  if (user) {
    if (isAdmin || user.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
    if (isInfluencer) return <Navigate to="/influencer/dashboard" replace />;
    if (isDriver || user.role === 'driver') return <Navigate to="/driver/dashboard" replace />;
    if (isMerchant || user.role === 'merchant') return <Navigate to="/merchant/dashboard" replace />;
    if (isRestaurateur) return <Navigate to="/eatery/dashboard" replace />;
    if (staffLoading) return <Loading />;
    if (staffStores.length > 0) return <Navigate to="/merchant/console" replace />;
  }

  return <>{children}</>;
};

export default RoleDashboardRedirect;
