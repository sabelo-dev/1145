import { useState } from 'react';
import { Users, TrendingUp, Info, Copy, Share2, Check, Loader2, Gift } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useReferral } from '@/hooks/useReferral';
import { useAuth } from '@/contexts/AuthContext';

// Social share icons as simple SVG components
const TwitterIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const TelegramIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
  </svg>
);

export function ReferralBonusInfo() {
  const { user } = useAuth();
  const { referralCode, stats, isLoading, getReferralLink, copyReferralLink, copyReferralCode } = useReferral();
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  const handleCopyCode = async () => {
    await copyReferralCode();
    setCopied('code');
    setTimeout(() => setCopied(null), 2000);
  };

  const handleCopyLink = async () => {
    await copyReferralLink();
    setCopied('link');
    setTimeout(() => setCopied(null), 2000);
  };

  const referralLink = getReferralLink();
  const shareText = `Join me on 1145 Lifestyle and get UCoin rewards! Use my referral code: ${referralCode?.code || ''}`;

  const shareLinks = {
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(referralLink)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}&quote=${encodeURIComponent(shareText)}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + referralLink)}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(shareText)}`,
  };

  const openShare = (platform: keyof typeof shareLinks) => {
    window.open(shareLinks[platform], '_blank', 'width=600,height=400');
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" />
          Referral Rewards
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Earn UCoin when friends sign up using your code!</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* User's Referral Code */}
        {user ? (
          <div className="space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Code Display */}
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-xs text-muted-foreground mb-1">Your Referral Code</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 font-mono text-lg font-bold text-primary tracking-wider">
                      {referralCode?.code || 'Generating...'}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCopyCode}
                      className="h-8 w-8 p-0"
                    >
                      {copied === 'code' ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Referral Link */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Shareable Link</p>
                  <div className="flex gap-2">
                    <Input
                      value={referralLink}
                      readOnly
                      className="text-xs font-mono h-9"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCopyLink}
                      className="h-9 px-3"
                    >
                      {copied === 'link' ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Social Share Buttons */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Share on Social Media</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openShare('twitter')}
                      className="flex-1 h-9 hover:bg-[#1DA1F2]/10 hover:text-[#1DA1F2] hover:border-[#1DA1F2]"
                    >
                      <TwitterIcon />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openShare('facebook')}
                      className="flex-1 h-9 hover:bg-[#1877F2]/10 hover:text-[#1877F2] hover:border-[#1877F2]"
                    >
                      <FacebookIcon />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openShare('whatsapp')}
                      className="flex-1 h-9 hover:bg-[#25D366]/10 hover:text-[#25D366] hover:border-[#25D366]"
                    >
                      <WhatsAppIcon />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openShare('telegram')}
                      className="flex-1 h-9 hover:bg-[#0088cc]/10 hover:text-[#0088cc] hover:border-[#0088cc]"
                    >
                      <TelegramIcon />
                    </Button>
                  </div>
                </div>

                {/* Stats */}
                {stats.totalReferrals > 0 && (
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <div className="p-2 rounded-lg bg-green-500/10 text-center">
                      <p className="text-lg font-bold text-green-600">{stats.signupsCompleted}</p>
                      <p className="text-xs text-muted-foreground">Signups</p>
                    </div>
                    <div className="p-2 rounded-lg bg-amber-500/10 text-center">
                      <p className="text-lg font-bold text-amber-600">{stats.totalEarned}</p>
                      <p className="text-xs text-muted-foreground">UCoin Earned</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="text-center py-3 text-sm text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Sign in to get your referral code</p>
          </div>
        )}

        {/* Bonus Tiers */}
        <div className="pt-2 border-t space-y-2">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            Mining Bonus from Referrals
          </p>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between p-2 rounded bg-primary/5 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="h-5 w-5 p-0 flex items-center justify-center text-xs">1</Badge>
                <span>Direct Referrals</span>
              </div>
              <span className="font-bold text-primary">10%</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-secondary/50 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center text-xs">2</Badge>
                <span>Second Level</span>
              </div>
              <span className="font-bold">3%</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-muted/50 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="h-5 w-5 p-0 flex items-center justify-center text-xs bg-muted">3</Badge>
                <span>Third Level</span>
              </div>
              <span className="font-bold text-muted-foreground">1%</span>
            </div>
          </div>
        </div>

        {/* Rewards Info */}
        <div className="p-3 rounded-lg border border-dashed bg-muted/30">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Rewards:</strong> Earn <span className="text-green-600 font-medium">50 UCoin</span> per signup + <span className="text-amber-600 font-medium">25 UCoin</span> on their first purchase!
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
