import { useState } from 'react';
import { Instagram, Facebook, Twitter, Youtube, Check, Link2, Unlink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SocialAccount } from '@/hooks/useSocialMining';

// TikTok icon component
const TikTokIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
  </svg>
);

const platformConfig: Record<string, { icon: React.ElementType; color: string; name: string }> = {
  instagram: { icon: Instagram, color: '#E4405F', name: 'Instagram' },
  facebook: { icon: Facebook, color: '#1877F2', name: 'Facebook' },
  twitter: { icon: Twitter, color: '#1DA1F2', name: 'X (Twitter)' },
  tiktok: { icon: TikTokIcon, color: '#000000', name: 'TikTok' },
  youtube: { icon: Youtube, color: '#FF0000', name: 'YouTube' }
};

interface SocialAccountConnectorProps {
  accounts: SocialAccount[];
  onConnect: (platform: SocialAccount['platform'], data: {
    platform_user_id: string;
    username: string;
    display_name?: string;
    follower_count?: number;
  }) => Promise<boolean>;
  onDisconnect: (accountId: string) => Promise<void>;
}

export function SocialAccountConnector({ accounts, onConnect, onDisconnect }: SocialAccountConnectorProps) {
  const [connectingPlatform, setConnectingPlatform] = useState<SocialAccount['platform'] | null>(null);
  const [username, setUsername] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const platforms: SocialAccount['platform'][] = ['instagram', 'facebook', 'twitter', 'tiktok', 'youtube'];

  const getAccountForPlatform = (platform: string) => 
    accounts.find(a => a.platform === platform);

  const handleConnect = async () => {
    if (!connectingPlatform || !username.trim()) return;
    
    setIsSubmitting(true);
    const success = await onConnect(connectingPlatform, {
      platform_user_id: username.toLowerCase().replace('@', ''),
      username: username.replace('@', ''),
      display_name: username.replace('@', ''),
      follower_count: 0
    });
    
    setIsSubmitting(false);
    if (success) {
      setConnectingPlatform(null);
      setUsername('');
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Connected Accounts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {platforms.map(platform => {
              const config = platformConfig[platform];
              const Icon = config.icon;
              const account = getAccountForPlatform(platform);
              const isConnected = !!account;

              return (
                <div
                  key={platform}
                  className={`relative p-3 rounded-lg border text-center transition-all ${
                    isConnected 
                      ? 'border-green-500/50 bg-green-500/5' 
                      : 'border-dashed hover:border-primary/50 cursor-pointer'
                  }`}
                  onClick={() => !isConnected && setConnectingPlatform(platform)}
                >
                  <Icon 
                    className="h-8 w-8 mx-auto mb-2" 
                    style={{ color: config.color }}
                  />
                  <p className="text-xs font-medium truncate">{config.name}</p>
                  
                  {isConnected ? (
                    <>
                      <Badge variant="secondary" className="mt-2 text-[10px]">
                        <Check className="h-3 w-3 mr-1" />
                        Connected
                      </Badge>
                      <p className="text-[10px] text-muted-foreground mt-1 truncate">
                        @{account.username}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-1 right-1 h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDisconnect(account.id);
                        }}
                      >
                        <Unlink className="h-3 w-3" />
                      </Button>
                    </>
                  ) : (
                    <p className="text-[10px] text-muted-foreground mt-2">
                      Click to connect
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!connectingPlatform} onOpenChange={() => setConnectingPlatform(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {connectingPlatform && (
                <>
                  {(() => {
                    const Icon = platformConfig[connectingPlatform].icon;
                    return <Icon className="h-5 w-5" style={{ color: platformConfig[connectingPlatform].color }} />;
                  })()}
                  Connect {platformConfig[connectingPlatform]?.name}
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="@yourusername"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Enter your {connectingPlatform && platformConfig[connectingPlatform]?.name} username
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConnectingPlatform(null)}>
              Cancel
            </Button>
            <Button onClick={handleConnect} disabled={!username.trim() || isSubmitting}>
              {isSubmitting ? 'Connecting...' : 'Connect Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
