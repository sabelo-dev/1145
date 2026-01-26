import React, { createContext, useState, useContext, useEffect } from "react";
import { User, Profile } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { useLoadingManager } from "@/hooks/useLoadingManager";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ redirectPath?: string }>;
  register: (email: string, password: string, name: string, role?: 'consumer' | 'vendor') => Promise<{ redirectPath?: string }>;
  logout: () => Promise<void>;
  isVendor: boolean;
  isAdmin: boolean;
  isDriver: boolean;
  isInfluencer: boolean;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isVendor, setIsVendor] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDriver, setIsDriver] = useState(false);
  const [isInfluencer, setIsInfluencer] = useState(false);
  const { toast } = useToast();
  const loadingManager = useLoadingManager();

  const getRedirectPathForRole = (userRole: string, isVendorApproved: boolean, isDriverUser: boolean, isInfluencerUser: boolean, isLogin: boolean = true): string => {
    if (userRole === 'admin') return '/admin/dashboard';
    if (isInfluencerUser) return '/influencer/dashboard';
    if (isDriverUser) return '/driver/dashboard';
    if (userRole === 'vendor') {
      return isLogin ? '/vendor/dashboard' : '/login';
    }
    return '/';
  };

  const clearAuthState = () => {
    setUser(null);
    setSession(null);
    setIsVendor(false);
    setIsAdmin(false);
    setIsDriver(false);
    setIsInfluencer(false);
  };

  const checkDriverStatus = async (userId: string): Promise<boolean> => {
    try {
      const { data: driver } = await supabase
        .from('drivers')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      return !!driver;
    } catch (error) {
      return false;
    }
  };

  const checkVendorStatus = async (userId: string): Promise<boolean> => {
    try {
      console.log('Checking vendor status for user:', userId);
      const { data: vendor } = await supabase
        .from('vendors')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      
      console.log('Vendor status check result:', vendor);
      // Return true if vendor record exists (regardless of approval status)
      // This allows vendors to access their dashboard even while pending approval
      const isVendor = !!vendor;
      console.log('Is vendor:', isVendor);
      return isVendor;
    } catch (error) {
      console.error('Error checking vendor status:', error);
      return false;
    }
  };


  const loadUserProfile = async (session: Session | null, operation: string = 'auth') => {
    if (!session?.user) {
      clearAuthState();
      loadingManager.stopLoading(operation);
      return;
    }

    try {
      // Fetch user profile and roles from separate tables (secure implementation)
      const [profileResult, rolesResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', session.user.id)
      ]);
      
      if (profileResult.error) {
        console.error('Error fetching profile:', profileResult.error);
        clearAuthState();
        loadingManager.stopLoading(operation);
        return;
      }
      
      const profile = profileResult.data;
      const roles = rolesResult.data || [];
      const userRoles = roles.map(r => r.role);
      
      if (profile) {
        // Determine primary role (for backwards compatibility)
        const primaryRole = userRoles.includes('admin') ? 'admin' : 
                          userRoles.includes('vendor') ? 'vendor' : 'consumer';
        
        const userData: User = {
          id: profile.id,
          email: profile.email,
          name: profile.name,
          avatar_url: profile.avatar_url,
          phone: profile.phone,
          role: primaryRole
        };
        setUser(userData);
        
        // Set role flags based on user_roles table
        setIsAdmin(userRoles.includes('admin'));
        setIsInfluencer(userRoles.includes('influencer'));
        
        // Check vendor and driver status
        const [vendorStatus, driverStatus] = await Promise.all([
          checkVendorStatus(profile.id),
          checkDriverStatus(profile.id)
        ]);
        setIsVendor(vendorStatus);
        setIsDriver(driverStatus);
      } else {
        // Create basic user data from session if no profile exists
        const userData: User = {
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata?.name || '',
          avatar_url: session.user.user_metadata?.avatar_url || null,
          role: 'consumer'
        };
        setUser(userData);
        setIsAdmin(false);
        setIsVendor(false);
        setIsDriver(false);
        setIsInfluencer(false);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      clearAuthState();
    } finally {
      loadingManager.stopLoading(operation);
    }
  };

  const refreshUserProfile = async () => {
    if (session?.user) {
      loadingManager.startLoading('refresh');
      await loadUserProfile(session, 'refresh');
    }
  };

  useEffect(() => {
    let mounted = true;
    loadingManager.startLoading('auth');

    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        console.log('Initial session check:', session ? 'Session found' : 'No session');
        
        if (error) {
          console.error('Error getting session:', error);
          if (mounted) loadingManager.stopLoading('auth');
          return;
        }

        if (mounted) {
          setSession(session);
          if (session) {
            await loadUserProfile(session);
          } else {
            loadingManager.stopLoading('auth');
          }
        }
      } catch (error) {
        console.error('Error in getInitialSession:', error);
        if (mounted) loadingManager.stopLoading('auth');
      }
    };

    getInitialSession();

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session ? 'Session exists' : 'No session');
        
        if (mounted) {
          setSession(session);
          
          // Handle auth events properly
          if (event === 'SIGNED_OUT') {
            clearAuthState();
            loadingManager.stopLoading('auth');
          } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            // Use setTimeout to prevent deadlock and allow proper state updates
            setTimeout(async () => {
              if (mounted && session) {
                await loadUserProfile(session);
              }
            }, 0);
          } else if (event === 'INITIAL_SESSION') {
            if (session) {
              setTimeout(async () => {
                if (mounted) {
                  await loadUserProfile(session);
                }
              }, 0);
            } else {
              loadingManager.stopLoading('auth');
            }
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<{ redirectPath?: string }> => {
    loadingManager.startLoading('login');
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        loadingManager.stopLoading('login');
        toast({
          variant: "destructive",
          title: "Login Failed",
          description: error.message,
        });
        throw error;
      }
      
      if (data.user) {
        // Get user roles from user_roles table and vendor status for redirect
        const [rolesResult, vendorResult, driverResult] = await Promise.all([
          supabase.from('user_roles').select('role').eq('user_id', data.user.id),
          checkVendorStatus(data.user.id),
          checkDriverStatus(data.user.id)
        ]);
        
        const userRoles = rolesResult.data?.map(r => r.role) || [];
        const isInfluencerUser = userRoles.includes('influencer');
        const userRole = userRoles.includes('admin') ? 'admin' : 
                        userRoles.includes('vendor') ? 'vendor' : 'consumer';
        const redirectPath = getRedirectPathForRole(userRole, vendorResult, driverResult, isInfluencerUser, true);
        
        toast({
          title: "Login Successful",
          description: "Welcome back!",
        });
        
        loadingManager.stopLoading('login');
        return { redirectPath };
      }
      
      loadingManager.stopLoading('login');
      return {};
    } catch (error) {
      loadingManager.stopLoading('login');
      if (error instanceof Error && !error.message.includes("Login Failed")) {
        toast({
          variant: "destructive",
          title: "Login Failed",
          description: error.message,
        });
      }
      throw error;
    }
  };

  const register = async (email: string, password: string, name: string, role: 'consumer' | 'vendor' = 'consumer'): Promise<{ redirectPath?: string }> => {
    loadingManager.startLoading('register');
    
    try {
      console.log('Starting registration process...');
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            name: name,
            role: role
          }
        }
      });
      
      console.log('Registration response:', { data, error });
      
      if (error) {
        console.error('Registration error:', error);
        loadingManager.stopLoading('register');
        
        // Handle specific error cases
        let errorMessage = error.message;
        if (error.message.includes('already registered') || error.message.includes('already been registered')) {
          errorMessage = "This email is already registered. Please try logging in instead.";
        } else if (error.message.includes('User already registered')) {
          errorMessage = "An account with this email already exists. Please sign in instead.";
        }
        
        toast({
          variant: "destructive",
          title: "Registration Failed",
          description: errorMessage,
        });
        throw error;
      }
      
      // Handle registration success
      if (data.user) {
        // Check if email confirmation is required
        if (!data.user.email_confirmed_at && data.session === null) {
          loadingManager.stopLoading('register');
          toast({
            title: "Registration Successful",
            description: "Please check your email to verify your account.",
          });
          return {};
        } else {
          // User is signed in immediately - always redirect to homepage after registration
          const redirectPath = '/';
          
          toast({
            title: "Registration Successful",
            description: "Welcome to LSI Platform!",
          });
          
          loadingManager.stopLoading('register');
          return { redirectPath };
        }
      } else {
        loadingManager.stopLoading('register');
        return {};
      }
    } catch (error) {
      loadingManager.stopLoading('register');
      console.error('Registration failed:', error);
      if (error instanceof Error && !error.message.includes("Registration Failed")) {
        toast({
          variant: "destructive",
          title: "Registration Failed",
          description: error.message,
        });
      }
      throw error;
    }
  };

  const logout = async () => {
    try {
      loadingManager.startLoading('logout');
      
      // Clear state first to prevent any pending requests
      clearAuthState();
      
      // Then sign out from Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Logout error:', error);
        toast({
          variant: "destructive",
          title: "Logout Failed",
          description: error.message,
        });
      } else {
        toast({
          title: "Logged Out",
          description: "You have been successfully logged out.",
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
      toast({
        variant: "destructive",
        title: "Logout Failed",
        description: "An error occurred while logging out.",
      });
    } finally {
      loadingManager.stopLoading('logout');
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading: loadingManager.isLoading, login, register, logout, isVendor, isAdmin, isDriver, isInfluencer, refreshUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthConsumer = AuthContext.Consumer;