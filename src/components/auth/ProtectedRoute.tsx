import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireAdmin?: boolean;
  requireVendor?: boolean;
  requireDriver?: boolean;
  fallbackPath?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAuth = false,
  requireAdmin = false,
  requireVendor = false,
  requireDriver = false,
  fallbackPath = '/'
}) => {
  const { user, isLoading, isAdmin, isVendor } = useAuth();
  const [isDriver, setIsDriver] = useState<boolean | null>(null);
  const [checkingDriver, setCheckingDriver] = useState(requireDriver);

  useEffect(() => {
    if (requireDriver && user) {
      supabase
        .from('drivers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          setIsDriver(!!data);
          setCheckingDriver(false);
        });
    } else {
      setCheckingDriver(false);
    }
  }, [user, requireDriver]);

  // Show loading while auth is being determined
  if (isLoading || checkingDriver) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect unauthenticated users if auth is required
  if (requireAuth && !user) {
    const loginPath = requireAdmin ? '/admin/login' : requireVendor ? '/vendor/login' : requireDriver ? '/driver/login' : '/login';
    return <Navigate to={loginPath} replace />;
  }

  // Redirect authenticated users away from auth pages
  if (!requireAuth && user) {
    if (isAdmin) return <Navigate to="/admin/dashboard" replace />;
    if (isVendor) return <Navigate to="/vendor/dashboard" replace />;
    if (isDriver) return <Navigate to="/driver/dashboard" replace />;
    return <Navigate to="/" replace />;
  }

  // Check admin access
  if (requireAdmin && (!user || !isAdmin)) {
    return <Navigate to="/admin/login" replace />;
  }

  // Check vendor access
  if (requireVendor && (!user || (user.role !== 'vendor' && !isVendor))) {
    return <Navigate to="/vendor/login" replace />;
  }

  // Check driver access
  if (requireDriver && (!user || !isDriver)) {
    return <Navigate to="/driver/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;