import { useState } from 'react';
import { 
  Share2, Users, MessageCircle, Repeat, Video, Star, Radio, Upload,
  Heart, CheckCircle2, Clock, AlertCircle, ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MiningTask, SocialAccount } from '@/hooks/useSocialMining';

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
}

export function MiningTaskList({
  tasks,
  socialAccounts,
  miningMultiplier,
  canCompleteTask,
  getCompletionsToday,
  onCompleteTask
}: MiningTaskListProps) {
  const [selectedTask, setSelectedTask] = useState<MiningTask | null>(null);
  const [proofUrl, setProofUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const affiliateTasks = tasks.filter(t => t.category === 'affiliate');
  const engagementTasks = tasks.filter(t => t.category === 'engagement');
  const contentTasks = tasks.filter(t => t.category === 'content');

  const handleSubmit = async () => {
    if (!selectedTask) return;
    
    // Proof URL is now required for ALL tasks
    if (!proofUrl.trim()) {
      return;
    }
    
    setIsSubmitting(true);
    await onCompleteTask(selectedTask.id, proofUrl);
    setIsSubmitting(false);
    setSelectedTask(null);
    setProofUrl('');
  };

  const renderTask = (task: MiningTask) => {
    const Icon = taskIcons[task.task_type] || CheckCircle2;
    const completionsToday = getCompletionsToday(task.id);
    const canComplete = canCompleteTask(task);
    const effectiveReward = Math.round(task.base_reward * miningMultiplier);

    return (
      <div
        key={task.id}
        className={`p-4 rounded-lg border transition-all ${
          canComplete 
            ? 'hover:border-primary/50 cursor-pointer' 
            : 'opacity-60'
        }`}
        onClick={() => canComplete && setSelectedTask(task)}
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
            </div>
            
            <p className="text-sm text-muted-foreground mt-1">
              {task.description}
            </p>
            
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {task.cooldown_hours}h cooldown
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {completionsToday}/{task.max_daily_completions} today
              </span>
              <span className="flex items-center gap-1 text-amber-600">
                <AlertCircle className="h-3 w-3" />
                Requires proof
              </span>
            </div>
          </div>

          {canComplete && (
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

            <div className="space-y-2">
              <Label htmlFor="proof">Proof URL (required)</Label>
              <Input
                id="proof"
                placeholder="https://instagram.com/p/... or https://twitter.com/..."
                value={proofUrl}
                onChange={(e) => setProofUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Provide a direct link to your completed action (post, story, comment, etc.)
              </p>
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  <AlertCircle className="inline h-3 w-3 mr-1" />
                  UCoin will only be credited after your submission is verified. 
                  Fraudulent submissions will be rejected.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTask(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting || !proofUrl.trim()}
            >
              {isSubmitting ? 'Submitting...' : 'Submit for Verification'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
