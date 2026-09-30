import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Pickaxe, Users, TrendingUp, Coins, Plus, Edit, 
  Sprout, Crown, Share2, Heart, Video 
} from 'lucide-react';
import { TaskSubmissionsReview } from '@/components/admin/rewards/TaskSubmissionsReview';
import { GrantRewardForm } from '@/components/admin/rewards/GrantRewardForm';
import { fetchRewardRules, ucToRand, type RewardRule } from '@/lib/ucRewards';

interface MiningTask {
  id: string;
  category: string;
  task_type: string;
  title: string;
  description: string | null;
  platform: string | null;
  base_reward: number;
  reward_tier: string;
  min_followers: number;
  cooldown_hours: number;
  requires_verification: boolean;
  max_daily_completions: number;
  is_active: boolean;
  reward_rule?: string | null;
}

interface AffiliateTier {
  id: string;
  name: string;
  display_name: string;
  level: number;
  min_conversions: number;
  mining_multiplier: number;
  daily_mining_cap: number;
  badge_color: string;
  monthly_price?: number;
  monthly_mining_cap?: number | null;
  base_mining?: number;
  cashback_percent?: number;
}

interface MiningStats {
  totalMiners: number;
  totalMined: number;
  activeToday: number;
  pendingVerifications: number;
}

export function AdminSocialMining() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [tasks, setTasks] = useState<MiningTask[]>([]);
  const [tiers, setTiers] = useState<AffiliateTier[]>([]);
  const [stats, setStats] = useState<MiningStats | null>(null);
  const [editingTask, setEditingTask] = useState<MiningTask | null>(null);
  // Admin-run range rules a task can pay under (e.g. Social/content 50-500 UC).
  const [taskRules, setTaskRules] = useState<RewardRule[]>([]);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTask, setNewTask] = useState<Partial<MiningTask>>({
    category: 'engagement',
    task_type: '',
    title: '',
    description: '',
    platform: 'any',
    base_reward: 50,
    reward_rule: 'social_content_task',
    reward_tier: 'low',
    min_followers: 0,
    cooldown_hours: 24,
    requires_verification: true,
    max_daily_completions: 1,
    is_active: true
  });

  const fetchData = async () => {
    setIsLoading(true);
    
    const [tasksRes, tiersRes, statsRes] = await Promise.all([
      supabase.from('mining_tasks').select('*').order('category', { ascending: true }),
      supabase.from('affiliate_tiers').select('*').order('level', { ascending: true }),
      supabase.from('user_affiliate_status').select('id, total_mined, last_mining_date')
    ]);

    if (tasksRes.data) setTasks(tasksRes.data);
    if (tiersRes.data) setTiers(tiersRes.data);
    
    if (statsRes.data) {
      const today = new Date().toISOString().split('T')[0];
      setStats({
        totalMiners: statsRes.data.length,
        totalMined: statsRes.data.reduce((sum, s) => sum + (Number(s.total_mined) || 0), 0),
        activeToday: statsRes.data.filter(s => s.last_mining_date === today).length,
        pendingVerifications: 0
      });
    }

    // Get pending verifications count
    const { count } = await supabase
      .from('mining_completions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    
    if (count !== null) {
      setStats(prev => prev ? { ...prev, pendingVerifications: count } : prev);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
    fetchRewardRules()
      .then((rules) => setTaskRules(rules.filter((r) => r.admin_granted && r.reward_kind === 'range')))
      .catch(() => setTaskRules([]));
  }, []);

  const ruleFor = (code?: string | null) => taskRules.find((r) => r.code === (code || 'social_content_task'));

  const updateTask = async (task: MiningTask) => {
    const { error } = await supabase
      .from('mining_tasks')
      .update(task)
      .eq('id', task.id);

    if (error) {
      toast({ title: 'Failed to update task', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Task updated successfully' });
      setEditingTask(null);
      fetchData();
    }
  };

  const addTask = async () => {
    const { error } = await supabase
      .from('mining_tasks')
      .insert([{
        category: newTask.category || 'engagement',
        task_type: newTask.task_type || '',
        title: newTask.title || '',
        description: newTask.description || null,
        platform: newTask.platform || 'any',
        base_reward: newTask.base_reward || 50,
        reward_rule: newTask.reward_rule || 'social_content_task',
        reward_tier: newTask.reward_tier || 'low',
        min_followers: newTask.min_followers || 0,
        cooldown_hours: newTask.cooldown_hours || 24,
        requires_verification: newTask.requires_verification !== false,
        max_daily_completions: newTask.max_daily_completions || 1,
        is_active: newTask.is_active !== false
      }]);

    if (error) {
      toast({ title: 'Failed to add task', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Task added successfully' });
      setIsAddingTask(false);
      setNewTask({
        category: 'engagement',
        task_type: '',
        title: '',
        description: '',
        platform: 'any',
        base_reward: 50,
        reward_rule: 'social_content_task',
        reward_tier: 'low',
        min_followers: 0,
        cooldown_hours: 24,
        requires_verification: true,
        max_daily_completions: 1,
        is_active: true
      });
      fetchData();
    }
  };

  const toggleTaskStatus = async (taskId: string, isActive: boolean) => {
    await supabase
      .from('mining_tasks')
      .update({ is_active: isActive })
      .eq('id', taskId);
    fetchData();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Miners</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalMiners || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total UCoin Mined</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalMined?.toLocaleString() || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Today</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeToday || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Verifications</CardTitle>
            <Pickaxe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pendingVerifications || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="tasks">
        <TabsList>
          <TabsTrigger value="tasks">Mining Tasks</TabsTrigger>
          <TabsTrigger value="submissions">
            Submissions{stats?.pendingVerifications ? ` (${stats.pendingVerifications})` : ''}
          </TabsTrigger>
          <TabsTrigger value="grant">Grant reward</TabsTrigger>
          <TabsTrigger value="tiers">Tiers</TabsTrigger>
        </TabsList>

        <TabsContent value="submissions" className="mt-4">
          <TaskSubmissionsReview onChanged={fetchData} />
        </TabsContent>

        <TabsContent value="grant" className="mt-4">
          <GrantRewardForm />
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Mining Tasks</CardTitle>
              <Button onClick={() => setIsAddingTask(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Task
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Reward</TableHead>
                    <TableHead>Cooldown</TableHead>
                    <TableHead>Verification</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">{task.title}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{task.category}</Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {task.base_reward} UC <span className="text-muted-foreground">({ucToRand(task.base_reward)})</span>
                      </TableCell>
                      <TableCell>{task.cooldown_hours}h</TableCell>
                      <TableCell>
                        {task.requires_verification ? (
                          <Badge variant="secondary">Required</Badge>
                        ) : (
                          <Badge variant="outline">Auto</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={task.is_active}
                          onCheckedChange={(checked) => toggleTaskStatus(task.id, checked)}
                        />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setEditingTask(task)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tiers" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Affiliate Tiers</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Level</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Qualified referrals</TableHead>
                    <TableHead>Monthly price</TableHead>
                    <TableHead>Max UC/day</TableHead>
                    <TableHead>Max UC/30 days</TableHead>
                    <TableHead>Base mining</TableHead>
                    <TableHead>Cashback</TableHead>
                    <TableHead>Task multiplier</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tiers.map((tier) => (
                    <TableRow key={tier.id}>
                      <TableCell>{tier.level}</TableCell>
                      <TableCell>
                        <Badge style={{ backgroundColor: tier.badge_color }} className="text-white">
                          {tier.display_name}
                        </Badge>
                      </TableCell>
                      <TableCell>{tier.min_conversions}</TableCell>
                      <TableCell>{Number(tier.monthly_price) > 0 ? `R${Number(tier.monthly_price).toLocaleString()}` : 'Free'}</TableCell>
                      <TableCell>{tier.daily_mining_cap.toLocaleString()} UC</TableCell>
                      <TableCell>{tier.monthly_mining_cap ? `${tier.monthly_mining_cap.toLocaleString()} UC` : '—'}</TableCell>
                      <TableCell>{tier.base_mining ?? 0} UC</TableCell>
                      <TableCell>{tier.cashback_percent ?? 1}%</TableCell>
                      <TableCell>{tier.mining_multiplier}×</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Task Dialog */}
      <Dialog open={!!editingTask} onOpenChange={() => setEditingTask(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Mining Task</DialogTitle>
          </DialogHeader>
          {editingTask && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={editingTask.title}
                  onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={editingTask.description || ''}
                  onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Reward type</Label>
                <Select value={editingTask.reward_rule || 'social_content_task'} onValueChange={(v) => setEditingTask({ ...editingTask, reward_rule: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {taskRules.map((r) => (
                      <SelectItem key={r.code} value={r.code}>{r.display_name} ({r.min_reward}–{r.max_reward} UC)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Reward (UC){ruleFor(editingTask.reward_rule) ? ` · ${ruleFor(editingTask.reward_rule)!.min_reward}–${ruleFor(editingTask.reward_rule)!.max_reward}` : ''}</Label>
                  <Input
                    type="number"
                    value={editingTask.base_reward}
                    onChange={(e) => setEditingTask({ ...editingTask, base_reward: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cooldown (hours)</Label>
                  <Input
                    type="number"
                    value={editingTask.cooldown_hours}
                    onChange={(e) => setEditingTask({ ...editingTask, cooldown_hours: parseInt(e.target.value) })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editingTask.requires_verification}
                    onCheckedChange={(checked) => setEditingTask({ ...editingTask, requires_verification: checked })}
                  />
                  <Label>Needs approval before paying</Label>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTask(null)}>Cancel</Button>
            <Button onClick={() => editingTask && updateTask(editingTask)}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Task Dialog */}
      <Dialog open={isAddingTask} onOpenChange={setIsAddingTask}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Mining Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Task Type (slug)</Label>
              <Input
                value={newTask.task_type}
                onChange={(e) => setNewTask({ ...newTask, task_type: e.target.value })}
                placeholder="e.g., share_story"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={newTask.category} onValueChange={(v) => setNewTask({ ...newTask, category: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="affiliate">Affiliate</SelectItem>
                  <SelectItem value="engagement">Engagement</SelectItem>
                  <SelectItem value="content">Content</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={newTask.description || ''}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Reward type</Label>
              <Select value={newTask.reward_rule || 'social_content_task'} onValueChange={(v) => setNewTask({ ...newTask, reward_rule: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {taskRules.map((r) => (
                    <SelectItem key={r.code} value={r.code}>{r.display_name} ({r.min_reward}–{r.max_reward} UC)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Reward (UC){ruleFor(newTask.reward_rule) ? ` · ${ruleFor(newTask.reward_rule)!.min_reward}–${ruleFor(newTask.reward_rule)!.max_reward}` : ''}</Label>
                <Input
                  type="number"
                  value={newTask.base_reward}
                  onChange={(e) => setNewTask({ ...newTask, base_reward: parseInt(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Cooldown (hours)</Label>
                <Input
                  type="number"
                  value={newTask.cooldown_hours}
                  onChange={(e) => setNewTask({ ...newTask, cooldown_hours: parseInt(e.target.value) })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddingTask(false)}>Cancel</Button>
            <Button onClick={addTask} disabled={!newTask.title || !newTask.task_type}>Add Task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
