import { useState } from 'react';
import { format } from 'date-fns';
import { useReferral } from '@/hooks/useReferral';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Users,
  Copy,
  Share2,
  Gift,
  Coins,
  UserPlus,
  ShoppingBag,
  CheckCircle,
  Clock,
  TrendingUp,
  Link as LinkIcon,
  QrCode,
} from 'lucide-react';

export function ReferralDashboard() {
  const { user } = useAuth();
  const {
    referralCode,
    referrals,
    stats,
    isLoading,
    claimReferralReward,
    getReferralLink,
    copyReferralLink,
    copyReferralCode,
  } = useReferral();

  const [isShareOpen, setIsShareOpen] = useState(false);

  if (!user) {
    return (
      <div className="text-center py-12">
        <Users className="h-16 w-16 mx-auto mb-4 text-primary opacity-50" />
        <h2 className="text-xl font-semibold mb-2">Sign in to access Referrals</h2>
        <p className="text-muted-foreground">Create an account or sign in to start referring friends and earning BiGold.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Referral Code Card */}
      <Card className="overflow-hidden border-0 shadow-lg">
        <div className="bg-gradient-to-br from-primary via-primary/90 to-primary/80 p-6 text-primary-foreground relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
          
          <div className="relative">
            <div className="flex items-center gap-2 mb-4">
              <Gift className="h-6 w-6" />
              <span className="font-semibold text-lg">Your Referral Code</span>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="bg-white/20 backdrop-blur-sm rounded-lg px-6 py-3 font-mono text-2xl font-bold tracking-wider">
                {referralCode?.code || 'Loading...'}
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={copyReferralCode}
                  className="bg-white/20 hover:bg-white/30 text-white border-0"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Code
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsShareOpen(true)}
                  className="bg-white/20 hover:bg-white/30 text-white border-0"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
              </div>
            </div>
            
            <p className="text-primary-foreground/80 text-sm mt-4">
              Share your code with friends. Earn <strong>50 BiGold</strong> when they sign up and <strong>25 BiGold</strong> when they make their first purchase!
            </p>
          </div>
        </div>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalReferrals}</div>
            <p className="text-xs text-muted-foreground">Friends invited</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Signups</CardTitle>
            <UserPlus className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.signupsCompleted}</div>
            <p className="text-xs text-muted-foreground">Completed signups</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Purchases</CardTitle>
            <ShoppingBag className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.purchasesCompleted}</div>
            <p className="text-xs text-muted-foreground">First purchases</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">BiGold Earned</CardTitle>
            <Coins className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.totalEarned}</div>
            {stats.pendingEarnings > 0 && (
              <p className="text-xs text-green-600">+{stats.pendingEarnings} pending</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Referral Rewards Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            How Referrals Work
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
              <div className="p-2 rounded-full bg-primary/10 text-primary">
                <Share2 className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-medium">1. Share Your Code</h4>
                <p className="text-sm text-muted-foreground">Share your unique referral code or link with friends</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
              <div className="p-2 rounded-full bg-green-500/10 text-green-600">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-medium">2. Friend Signs Up</h4>
                <p className="text-sm text-muted-foreground">You earn <strong>50 BiGold</strong> when they create an account</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
              <div className="p-2 rounded-full bg-amber-500/10 text-amber-600">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-medium">3. First Purchase</h4>
                <p className="text-sm text-muted-foreground">Earn <strong>25 BiGold</strong> more when they make their first purchase</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Referrals List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Your Referrals
          </CardTitle>
          <CardDescription>Track your referrals and claim rewards</CardDescription>
        </CardHeader>
        <CardContent>
          {referrals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No referrals yet</p>
              <p className="text-sm">Share your code to start earning BiGold!</p>
            </div>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {referrals.map((referral) => (
                  <div
                    key={referral.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={referral.referred_profile?.avatar_url || ''} />
                        <AvatarFallback>
                          {referral.referred_profile?.name?.charAt(0)?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">
                          {referral.referred_profile?.name || 'Anonymous User'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Joined {format(new Date(referral.created_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {referral.status === 'signup_completed' && !referral.signup_reward_paid && (
                        <Button
                          size="sm"
                          onClick={() => claimReferralReward(referral.id, 'signup')}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Coins className="h-3 w-3 mr-1" />
                          Claim 50
                        </Button>
                      )}
                      
                      {referral.status === 'purchase_completed' && !referral.purchase_reward_paid && (
                        <Button
                          size="sm"
                          onClick={() => claimReferralReward(referral.id, 'purchase')}
                          className="bg-amber-600 hover:bg-amber-700"
                        >
                          <Coins className="h-3 w-3 mr-1" />
                          Claim 25
                        </Button>
                      )}
                      
                      <div className="flex gap-1">
                        {referral.signup_reward_paid && (
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Signup
                          </Badge>
                        )}
                        {referral.purchase_reward_paid && (
                          <Badge variant="outline" className="text-amber-600 border-amber-600">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Purchase
                          </Badge>
                        )}
                        {referral.status === 'signup_completed' && !referral.purchase_reward_paid && (
                          <Badge variant="secondary">
                            <Clock className="h-3 w-3 mr-1" />
                            Awaiting Purchase
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Share Dialog */}
      <Dialog open={isShareOpen} onOpenChange={setIsShareOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-primary" />
              Share Your Referral
            </DialogTitle>
            <DialogDescription>
              Share your unique link or code with friends to earn BiGold rewards
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Referral Link</label>
              <div className="flex gap-2">
                <Input value={getReferralLink()} readOnly className="font-mono text-sm" />
                <Button onClick={copyReferralLink}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Referral Code</label>
              <div className="flex gap-2">
                <Input value={referralCode?.code || ''} readOnly className="font-mono text-lg font-bold" />
                <Button onClick={copyReferralCode}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Tip:</strong> Share on social media, messaging apps, or email to reach more friends!
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsShareOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
