import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireAdmin?: boolean;
  requireMerchant?: boolean;
  requireDriver?: boolean;
  requireInfluencer?: boolean;
  fallbackPath?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAuth = false,
  requireAdmin = false,
  requireMerchant = false,
  requireDriver = false,
  requireInfluencer = false,
  fallbackPath = '/'
}) => {
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

  if (requireAuth && !user) {
    const loginPath = requireAdmin ? '/admin/login' : 
                      requireMerchant ? '/merchant/login' : 
                      requireDriver ? '/driver/login' : 
                      requireInfluencer ? '/influencer/login' : '/login';
    return <Navigate to={loginPath} replace />;
  }

  if (!requireAuth && user) {
    if (isAdmin) return <Navigate to="/admin/dashboard" replace />;
    if (isInfluencer) return <Navigate to="/influencer/dashboard" replace />;
    if (isDriver) return <Navigate to="/driver/dashboard" replace />;
    if (isMerchant) return <Navigate to="/merchant/dashboard" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  if (requireAdmin && (!user || !isAdmin)) {
    return <Navigate to="/admin/login" replace />;
  }

  if (requireMerchant && (!user || !isMerchant)) {
    return <Navigate to="/merchant/login" replace />;
  }

  if (requireDriver && (!user || !isDriver)) {
    return <Navigate to="/driver/login" replace />;
  }

  if (requireInfluencer && (!user || !isInfluencer)) {
    return <Navigate to="/influencer/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
