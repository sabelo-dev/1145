import { useState } from 'react';
import { 
  Share2, Users, MessageCircle, Repeat, Video, Star, Radio, Upload,
  Heart, CheckCircle2, Clock, AlertCircle, ChevronRight, Link2, Instagram,
  Facebook, Twitter, Youtube
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MiningTask, SocialAccount } from '@/hooks/useSocialMining';

// TikTok icon component
const TikTokIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
  </svg>
);

const taskIcons: Record<string, React.ElementType> = {
  referral_link_share: Share2,
  conversion_referral: Users,
  brand_mention: Star,
  promo_code_use: Star,
  like_post: Heart,
  comment_post: MessageCircle,
  repost: Repeat,
  story_share: Share2,
  short_video: Video,
  review_post: Star,
  livestream_mention: Radio,
  ugc_upload: Upload
};

const platformIcons: Record<string, React.ElementType> = {
  instagram: Instagram,
  facebook: Facebook,
  twitter: Twitter,
  tiktok: TikTokIcon,
  youtube: Youtube
};

const platformColors: Record<string, string> = {
  instagram: '#E4405F',
  facebook: '#1877F2',
  twitter: '#1DA1F2',
  tiktok: '#000000',
  youtube: '#FF0000'
};

const platformNames: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  twitter: 'X (Twitter)',
  tiktok: 'TikTok',
  youtube: 'YouTube'
};

const rewardColors: Record<string, string> = {
  very_low: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  low: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  medium: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  high: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  very_high: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
};

interface MiningTaskListProps {
  tasks: MiningTask[];
  socialAccounts: SocialAccount[];
  miningMultiplier: number;
  canCompleteTask: (task: MiningTask) => boolean;
  getCompletionsToday: (taskId: string) => number;
  onCompleteTask: (taskId: string, proofUrl?: string, socialAccountId?: string) => Promise<unknown>;
  onConnectAccount?: (platform: SocialAccount['platform'], data: {
    platform_user_id: string;
    username: string;
    display_name?: string;
    follower_count?: number;
  }) => Promise<boolean>;
}

export function MiningTaskList({
  tasks,
  socialAccounts,
  miningMultiplier,
  canCompleteTask,
  getCompletionsToday,
  onCompleteTask,
  onConnectAccount
}: MiningTaskListProps) {
  const [selectedTask, setSelectedTask] = useState<MiningTask | null>(null);
  const [proofUrl, setProofUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [connectingPlatform, setConnectingPlatform] = useState<SocialAccount['platform'] | null>(null);
  const [connectUsername, setConnectUsername] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  const isPlatformConnected = (platform: string | null) => {
    if (!platform || platform === 'any') return true;
    return socialAccounts.some(a => a.platform === platform);
  };

  const handleQuickConnect = async () => {
    if (!connectingPlatform || !connectUsername.trim() || !onConnectAccount) return;
    
    setIsConnecting(true);
    const success = await onConnectAccount(connectingPlatform, {
      platform_user_id: connectUsername.toLowerCase().replace('@', ''),
      username: connectUsername.replace('@', ''),
      display_name: connectUsername.replace('@', ''),
      follower_count: 0
    });
    
    setIsConnecting(false);
    if (success) {
      setConnectingPlatform(null);
      setConnectUsername('');
    }
  };

  const affiliateTasks = tasks.filter(t => t.category === 'affiliate');
  const engagementTasks = tasks.filter(t => t.category === 'engagement');
  const contentTasks = tasks.filter(t => t.category === 'content');

  const handleSubmit = async () => {
    if (!selectedTask) return;
    
    setIsSubmitting(true);
    await onCompleteTask(selectedTask.id, undefined);
    setIsSubmitting(false);
    setSelectedTask(null);
  };

  const renderTask = (task: MiningTask) => {
    const Icon = taskIcons[task.task_type] || CheckCircle2;
    const completionsToday = getCompletionsToday(task.id);
    const canComplete = canCompleteTask(task);
    const effectiveReward = Math.round(task.base_reward * miningMultiplier);
    const needsConnection = task.platform && task.platform !== 'any' && !isPlatformConnected(task.platform);
    const PlatformIcon = task.platform && task.platform !== 'any' ? platformIcons[task.platform] : null;

    return (
      <div
        key={task.id}
        className={`p-4 rounded-lg border transition-all ${
          canComplete && !needsConnection
            ? 'hover:border-primary/50 cursor-pointer' 
            : 'opacity-80'
        }`}
        onClick={() => canComplete && !needsConnection && setSelectedTask(task)}
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-medium">{task.title}</h4>
              <Badge className={rewardColors[task.reward_tier]} variant="secondary">
                +{effectiveReward} UCoin
              </Badge>
              {task.platform && task.platform !== 'any' && PlatformIcon && (
                <Badge variant="outline" className="gap-1">
                  <PlatformIcon className="h-3 w-3" style={{ color: platformColors[task.platform] }} />
                  {platformNames[task.platform]}
                </Badge>
              )}
            </div>
            
            <p className="text-sm text-muted-foreground mt-1">
              {task.description}
            </p>
            
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {task.cooldown_hours}h cooldown
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {completionsToday}/{task.max_daily_completions} today
              </span>
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="h-3 w-3" />
                Auto-verified
              </span>
            </div>

            {/* Quick connect prompt for disconnected platforms */}
            {needsConnection && task.platform && onConnectAccount && (
              <div className="mt-3 p-2 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-1">
                    <Link2 className="h-3 w-3" />
                    Connect your {platformNames[task.platform]} to complete this task
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConnectingPlatform(task.platform as SocialAccount['platform']);
                    }}
                  >
                    {PlatformIcon && <PlatformIcon className="h-3 w-3" style={{ color: platformColors[task.platform] }} />}
                    Connect Now
                  </Button>
                </div>
              </div>
            )}
          </div>

          {canComplete && !needsConnection && (
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Mining Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="affiliate">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="affiliate">Affiliate</TabsTrigger>
              <TabsTrigger value="engagement">Engagement</TabsTrigger>
              <TabsTrigger value="content">Content</TabsTrigger>
            </TabsList>

            <TabsContent value="affiliate" className="space-y-3 mt-4">
              {affiliateTasks.length > 0 ? (
                affiliateTasks.map(renderTask)
              ) : (
                <p className="text-center text-muted-foreground py-4">No affiliate tasks available</p>
              )}
            </TabsContent>

            <TabsContent value="engagement" className="space-y-3 mt-4">
              {engagementTasks.length > 0 ? (
                engagementTasks.map(renderTask)
              ) : (
                <p className="text-center text-muted-foreground py-4">No engagement tasks available</p>
              )}
            </TabsContent>

            <TabsContent value="content" className="space-y-3 mt-4">
              {contentTasks.length > 0 ? (
                contentTasks.map(renderTask)
              ) : (
                <p className="text-center text-muted-foreground py-4">No content tasks available</p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedTask?.title}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              {selectedTask?.description}
            </p>
            
            <div className="p-3 rounded-lg bg-primary/10">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Reward</span>
                <span className="font-bold">
                  +{selectedTask && Math.round(selectedTask.base_reward * miningMultiplier)} UCoin
                </span>
              </div>
              {miningMultiplier > 1 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Includes {miningMultiplier}× tier multiplier
                </p>
              )}
            </div>

            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
              <p className="text-xs text-green-700 dark:text-green-300">
                <CheckCircle2 className="inline h-3 w-3 mr-1" />
                UCoin will be credited instantly upon completion.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTask(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Completing...' : 'Complete Task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Connect Dialog */}
      <Dialog open={!!connectingPlatform} onOpenChange={() => setConnectingPlatform(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {connectingPlatform && platformIcons[connectingPlatform] && (() => {
                const PIcon = platformIcons[connectingPlatform];
                return <PIcon className="h-5 w-5" style={{ color: platformColors[connectingPlatform] }} />;
              })()}
              Connect {connectingPlatform && platformNames[connectingPlatform]}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Connect your account to complete tasks on this platform and earn UCoin.
            </p>
            
            <div className="space-y-2">
              <Label htmlFor="connect-username">Username</Label>
              <Input
                id="connect-username"
                placeholder="@yourusername"
                value={connectUsername}
                onChange={(e) => setConnectUsername(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Enter your {connectingPlatform && platformNames[connectingPlatform]} username
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConnectingPlatform(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleQuickConnect} 
              disabled={!connectUsername.trim() || isConnecting}
              className="gap-2"
            >
              {connectingPlatform && platformIcons[connectingPlatform] && (() => {
                const PIcon = platformIcons[connectingPlatform];
                return <PIcon className="h-4 w-4" />;
              })()}
              {isConnecting ? 'Connecting...' : 'Connect Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
