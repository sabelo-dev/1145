import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Link2, ExternalLink, CheckCircle, AlertCircle, RefreshCw, 
  Trash2, Loader2, Info
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Session } from '@supabase/supabase-js';

// Platform icons as inline SVGs to avoid style prop issues
const FacebookIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="#1877F2">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const InstagramIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="#E4405F">
    <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.757-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z"/>
  </svg>
);

const TwitterIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="#000000">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const LinkedinIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="#0A66C2">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

interface OAuthToken {
  id: string;
  platform: string;
  account_id: string;
  account_handle: string;
  page_name?: string;
  is_active: boolean;
  token_expires_at?: string;
  created_at: string;
}

interface PlatformConfig {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  description: string;
}

const PLATFORMS: PlatformConfig[] = [
  { 
    id: 'facebook', 
    name: 'Facebook', 
    icon: FacebookIcon, 
    color: '#1877F2',
    description: 'Connect your Facebook Pages to publish posts and track engagement'
  },
  { 
    id: 'instagram', 
    name: 'Instagram', 
    icon: InstagramIcon, 
    color: '#E4405F',
    description: 'Connect your Instagram Business account via Facebook'
  },
  { 
    id: 'twitter', 
    name: 'X (Twitter)', 
    icon: TwitterIcon, 
    color: '#000000',
    description: 'Connect your Twitter account to post tweets'
  },
  { 
    id: 'linkedin', 
    name: 'LinkedIn', 
    icon: LinkedinIcon, 
    color: '#0A66C2',
    description: 'Connect your LinkedIn profile to share updates'
  },
];

export const SocialOAuthConnect: React.FC = () => {
  const { user } = useAuth();
  const [session, setSession] = useState<Session | null>(null);
  const [connectedAccounts, setConnectedAccounts] = useState<OAuthToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [disconnectDialog, setDisconnectDialog] = useState<{ open: boolean; account: OAuthToken | null }>({
    open: false,
    account: null,
  });
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [setupRequired, setSetupRequired] = useState<Record<string, boolean>>({});

  // Get session on mount
  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
    };
    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchConnectedAccounts = useCallback(async () => {
    if (!user || !session?.access_token) return;

    try {
      const response = await fetch(
        `https://hipomusjocacncjsvgfa.supabase.co/functions/v1/social-oauth?action=list_tokens`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();
      
      if (data.error) {
        console.error('Error fetching accounts:', data.error);
        toast.error('Failed to load connected accounts');
      } else {
        setConnectedAccounts(data.tokens || []);
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
    } finally {
      setLoading(false);
    }
  }, [user, session?.access_token]);

  useEffect(() => {
    fetchConnectedAccounts();
  }, [fetchConnectedAccounts]);

  // Check URL params for OAuth callback status
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const error = urlParams.get('error');
    const platform = urlParams.get('platform');

    if (success === 'true' && platform) {
      toast.success(`Successfully connected ${platform}!`);
      fetchConnectedAccounts();
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (error) {
      toast.error(`Connection failed: ${error}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [fetchConnectedAccounts]);

  const handleConnect = async (platformId: string) => {
    if (!session?.access_token) {
      toast.error('You must be logged in to connect accounts');
      return;
    }

    setConnectingPlatform(platformId);

    try {
      const appUrl = window.location.origin;
      const response = await fetch(
        `https://hipomusjocacncjsvgfa.supabase.co/functions/v1/social-oauth?action=get_auth_url&platform=${platformId}&app_url=${encodeURIComponent(appUrl)}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();

      if (data.setup_required) {
        setSetupRequired(prev => ({ ...prev, [platformId]: true }));
        toast.error(data.error, {
          description: data.instructions,
          duration: 10000,
        });
      } else if (data.auth_url) {
        // Redirect to OAuth provider
        window.location.href = data.auth_url;
      } else if (data.error) {
        toast.error(data.error);
      }
    } catch (error) {
      console.error('Error getting auth URL:', error);
      toast.error('Failed to start connection process');
    } finally {
      setConnectingPlatform(null);
    }
  };

  const handleDisconnect = async () => {
    if (!disconnectDialog.account || !session?.access_token) return;

    setIsDisconnecting(true);

    try {
      const response = await fetch(
        `https://hipomusjocacncjsvgfa.supabase.co/functions/v1/social-oauth?action=disconnect&token_id=${disconnectDialog.account.id}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();

      if (data.success) {
        toast.success('Account disconnected');
        setDisconnectDialog({ open: false, account: null });
        fetchConnectedAccounts();
      } else {
        toast.error(data.error || 'Failed to disconnect account');
      }
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast.error('Failed to disconnect account');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleRefreshToken = async (tokenId: string) => {
    if (!session?.access_token) return;

    try {
      const response = await fetch(
        `https://hipomusjocacncjsvgfa.supabase.co/functions/v1/social-oauth?action=refresh_token&token_id=${tokenId}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();

      if (data.success) {
        toast.success('Token refreshed successfully');
        fetchConnectedAccounts();
      } else {
        toast.error(data.error || 'Failed to refresh token');
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      toast.error('Failed to refresh token');
    }
  };

  const getConnectedAccountsForPlatform = (platformId: string) => {
    return connectedAccounts.filter(a => a.platform === platformId);
  };

  const isTokenExpiring = (expiresAt?: string) => {
    if (!expiresAt) return false;
    const daysUntilExpiry = (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return daysUntilExpiry < 7;
  };

  const getPlatformIcon = (platformId: string) => {
    const platform = PLATFORMS.find(p => p.id === platformId);
    if (!platform) return null;
    const Icon = platform.icon;
    return <Icon className="h-5 w-5" />;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Connect Social Media APIs
          </CardTitle>
          <CardDescription>
            Connect your social media accounts using OAuth to enable automatic posting
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              OAuth connections allow the platform to post directly to your social media accounts. 
              Your credentials are securely stored and you can revoke access at any time.
            </AlertDescription>
          </Alert>

          <div className="grid gap-4">
            {PLATFORMS.map((platform) => {
              const connectedPlatformAccounts = getConnectedAccountsForPlatform(platform.id);
              const isConnected = connectedPlatformAccounts.length > 0;
              const isConnecting = connectingPlatform === platform.id;
              const needsSetup = setupRequired[platform.id];
              const Icon = platform.icon;

              return (
                <div
                  key={platform.id}
                  className={`p-4 rounded-lg border ${
                    isConnected ? 'border-green-500/50 bg-green-500/5' : 'border-border'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div 
                        className="p-2 rounded-lg" 
                        style={{ backgroundColor: `${platform.color}15` }}
                      >
                        <Icon className="h-6 w-6" />
                      </div>
                      <div>
                        <h4 className="font-medium flex items-center gap-2">
                          {platform.name}
                          {isConnected && (
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Connected
                            </Badge>
                          )}
                        </h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {platform.description}
                        </p>
                      </div>
                    </div>

                    {!isConnected ? (
                      <Button
                        onClick={() => handleConnect(platform.id)}
                        disabled={isConnecting || needsSetup}
                        variant={needsSetup ? 'outline' : 'default'}
                      >
                        {isConnecting ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : needsSetup ? (
                          <AlertCircle className="h-4 w-4 mr-2 text-amber-500" />
                        ) : null}
                        {needsSetup ? 'Setup Required' : 'Connect'}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleConnect(platform.id)}
                        disabled={isConnecting}
                      >
                        {isConnecting ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : null}
                        Add Another
                      </Button>
                    )}
                  </div>

                  {/* Connected accounts list */}
                  {connectedPlatformAccounts.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {connectedPlatformAccounts.map((account) => {
                        const expiring = isTokenExpiring(account.token_expires_at);
                        
                        return (
                          <div
                            key={account.id}
                            className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                          >
                            <div className="flex items-center gap-3">
                              {getPlatformIcon(account.platform)}
                              <div>
                                <div className="font-medium text-sm">
                                  {account.page_name || account.account_handle || account.account_id}
                                </div>
                                {account.token_expires_at && (
                                  <div className={`text-xs ${expiring ? 'text-amber-600' : 'text-muted-foreground'}`}>
                                    {expiring && <AlertCircle className="h-3 w-3 inline mr-1" />}
                                    Expires {format(new Date(account.token_expires_at), 'MMM d, yyyy')}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {expiring && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRefreshToken(account.id)}
                                  title="Refresh token"
                                >
                                  <RefreshCw className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDisconnectDialog({ open: true, account })}
                                className="text-destructive hover:text-destructive"
                                title="Disconnect"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {needsSetup && (
                    <Alert variant="destructive" className="mt-3">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        API credentials not configured. Admin needs to add {platform.name} API keys to edge function secrets.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Disconnect confirmation dialog */}
      <Dialog 
        open={disconnectDialog.open} 
        onOpenChange={(open) => !open && setDisconnectDialog({ open: false, account: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect Account</DialogTitle>
            <DialogDescription>
              Are you sure you want to disconnect {disconnectDialog.account?.page_name || disconnectDialog.account?.account_handle}? 
              You will need to reconnect if you want to post to this account again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDisconnectDialog({ open: false, account: null })}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisconnect}
              disabled={isDisconnecting}
            >
              {isDisconnecting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
