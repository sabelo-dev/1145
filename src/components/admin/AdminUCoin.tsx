import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Coins,
  TrendingUp,
  TrendingDown,
  Edit,
  Plus,
  Save,
  X,
  Sparkles,
  Gift,
  Users,
  ShoppingBag,
  Truck,
  Star,
  Zap,
  Trophy,
  Clock,
  UserCheck,
  Percent,
  Rocket,
  Banknote,
} from 'lucide-react';
import { UCoinEarningRule, UCoinSpendingOption } from '@/types/ucoin';

const categoryIcons: Record<string, React.ReactNode> = {
  order_completed: <ShoppingBag className="h-4 w-4" />,
  delivery_completed: <Truck className="h-4 w-4" />,
  review_submitted: <Star className="h-4 w-4" />,
  referral_signup: <Users className="h-4 w-4" />,
  referral_purchase: <Users className="h-4 w-4" />,
  ontime_delivery: <Clock className="h-4 w-4" />,
  sales_milestone_100: <Trophy className="h-4 w-4" />,
  sales_milestone_500: <Trophy className="h-4 w-4" />,
  sales_milestone_1000: <Trophy className="h-4 w-4" />,
  daily_login: <Zap className="h-4 w-4" />,
  profile_complete: <UserCheck className="h-4 w-4" />,
  discount_5_percent: <Percent className="h-4 w-4" />,
  discount_10_percent: <Percent className="h-4 w-4" />,
  free_delivery: <Truck className="h-4 w-4" />,
  delivery_discount: <Truck className="h-4 w-4" />,
  ad_boost_basic: <Rocket className="h-4 w-4" />,
  ad_boost_premium: <Rocket className="h-4 w-4" />,
  priority_listing: <Rocket className="h-4 w-4" />,
  cashout_driver: <Banknote className="h-4 w-4" />,
  cashout_vendor: <Banknote className="h-4 w-4" />,
};

interface Stats {
  totalWallets: number;
  totalBalance: number;
  totalEarned: number;
  totalSpent: number;
}

export default function AdminUCoin() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [earningRules, setEarningRules] = useState<UCoinEarningRule[]>([]);
  const [spendingOptions, setSpendingOptions] = useState<UCoinSpendingOption[]>([]);
  const [stats, setStats] = useState<Stats>({ totalWallets: 0, totalBalance: 0, totalEarned: 0, totalSpent: 0 });
  
  const [editingRule, setEditingRule] = useState<UCoinEarningRule | null>(null);
  const [editingOption, setEditingOption] = useState<UCoinSpendingOption | null>(null);
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [isAddingOption, setIsAddingOption] = useState(false);

  // Form states for new items
  const [newRule, setNewRule] = useState({ category: '', amount: 0, description: '', multiplier: 1, is_active: true });
  const [newOption, setNewOption] = useState<{
    category: string;
    cost: number;
    value: number;
    value_type: 'percentage' | 'fixed' | 'boost';
    description: string;
    is_active: boolean;
    min_balance: number;
    user_types: string[];
  }>({ 
    category: '', cost: 0, value: 0, value_type: 'percentage', 
    description: '', is_active: true, min_balance: 0, user_types: ['consumer'] 
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    
    const [rulesRes, optionsRes, statsRes] = await Promise.all([
      supabase.from('ucoin_earning_rules').select('*').order('amount', { ascending: false }),
      supabase.from('ucoin_spending_options').select('*').order('cost', { ascending: true }),
      supabase.from('ucoin_wallets').select('balance, lifetime_earned, lifetime_spent')
    ]);

    if (rulesRes.data) setEarningRules(rulesRes.data as UCoinEarningRule[]);
    if (optionsRes.data) setSpendingOptions(optionsRes.data as UCoinSpendingOption[]);
    
    if (statsRes.data) {
      const wallets = statsRes.data;
      setStats({
        totalWallets: wallets.length,
        totalBalance: wallets.reduce((sum, w) => sum + Number(w.balance), 0),
        totalEarned: wallets.reduce((sum, w) => sum + Number(w.lifetime_earned), 0),
        totalSpent: wallets.reduce((sum, w) => sum + Number(w.lifetime_spent), 0),
      });
    }

    setIsLoading(false);
  };

  const updateRule = async (rule: UCoinEarningRule) => {
    const { error } = await supabase
      .from('ucoin_earning_rules')
      .update({
        amount: rule.amount,
        description: rule.description,
        multiplier: rule.multiplier,
        is_active: rule.is_active,
      })
      .eq('id', rule.id);

    if (error) {
      toast({ title: 'Error updating rule', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Rule updated successfully' });
      setEditingRule(null);
      fetchData();
    }
  };

  const updateOption = async (option: UCoinSpendingOption) => {
    const { error } = await supabase
      .from('ucoin_spending_options')
      .update({
        cost: option.cost,
        value: option.value,
        value_type: option.value_type,
        description: option.description,
        is_active: option.is_active,
        min_balance: option.min_balance,
        user_types: option.user_types,
      })
      .eq('id', option.id);

    if (error) {
      toast({ title: 'Error updating option', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Spending option updated successfully' });
      setEditingOption(null);
      fetchData();
    }
  };

  const addRule = async () => {
    const { error } = await supabase.from('ucoin_earning_rules').insert(newRule);
    
    if (error) {
      toast({ title: 'Error adding rule', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Earning rule added successfully' });
      setIsAddingRule(false);
      setNewRule({ category: '', amount: 0, description: '', multiplier: 1, is_active: true });
      fetchData();
    }
  };

  const addOption = async () => {
    const { error } = await supabase.from('ucoin_spending_options').insert(newOption);
    
    if (error) {
      toast({ title: 'Error adding option', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Spending option added successfully' });
      setIsAddingOption(false);
      setNewOption({ category: '', cost: 0, value: 0, value_type: 'percentage', description: '', is_active: true, min_balance: 0, user_types: ['consumer'] });
      fetchData();
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Wallets</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalWallets.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Active UCoin users</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
            <Coins className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.totalBalance.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">UCoin in circulation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Earned</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.totalEarned.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">All-time earned</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            <TrendingDown className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.totalSpent.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">All-time redeemed</p>
          </CardContent>
        </Card>
      </div>

      {/* Management Tabs */}
      <Tabs defaultValue="earning" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="earning" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Earning Rules
          </TabsTrigger>
          <TabsTrigger value="spending" className="flex items-center gap-2">
            <Gift className="h-4 w-4" />
            Spending Options
          </TabsTrigger>
        </TabsList>

        <TabsContent value="earning" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Earning Rules</CardTitle>
                  <CardDescription>Configure how users earn UCoin</CardDescription>
                </div>
                <Button onClick={() => setIsAddingRule(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Rule
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Base Amount</TableHead>
                    <TableHead className="text-right">Multiplier</TableHead>
                    <TableHead className="text-right">Effective</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {earningRules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                            {categoryIcons[rule.category] || <Coins className="h-4 w-4" />}
                          </div>
                          <span className="font-medium text-sm">{rule.category.replace(/_/g, ' ')}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                        {rule.description}
                      </TableCell>
                      <TableCell className="text-right font-medium">{rule.amount}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={rule.multiplier > 1 ? 'default' : 'secondary'}>
                          {rule.multiplier}x
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-amber-600">
                        {rule.amount * rule.multiplier}
                      </TableCell>
                      <TableCell>
                        <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                          {rule.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setEditingRule(rule)}>
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

        <TabsContent value="spending" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Spending Options</CardTitle>
                  <CardDescription>Configure rewards users can redeem</CardDescription>
                </div>
                <Button onClick={() => setIsAddingOption(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Option
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead>User Types</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {spendingOptions.map((option) => (
                    <TableRow key={option.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                            {categoryIcons[option.category] || <Gift className="h-4 w-4" />}
                          </div>
                          <span className="font-medium text-sm">{option.category.replace(/_/g, ' ')}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                        {option.description}
                      </TableCell>
                      <TableCell className="text-right font-bold text-amber-600">{option.cost}</TableCell>
                      <TableCell className="text-right">
                        {option.value}{option.value_type === 'percentage' ? '%' : option.value_type === 'boost' ? 'hrs' : ''}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {option.user_types.map((type) => (
                            <Badge key={type} variant="outline" className="text-xs">
                              {type}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={option.is_active ? 'default' : 'secondary'}>
                          {option.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setEditingOption(option)}>
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
      </Tabs>

      {/* Edit Rule Dialog */}
      <Dialog open={!!editingRule} onOpenChange={() => setEditingRule(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Earning Rule</DialogTitle>
          </DialogHeader>
          {editingRule && (
            <div className="space-y-4">
              <div>
                <Label>Category</Label>
                <Input value={editingRule.category.replace(/_/g, ' ')} disabled />
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={editingRule.description || ''}
                  onChange={(e) => setEditingRule({ ...editingRule, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Base Amount</Label>
                  <Input
                    type="number"
                    value={editingRule.amount}
                    onChange={(e) => setEditingRule({ ...editingRule, amount: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Multiplier</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={editingRule.multiplier}
                    onChange={(e) => setEditingRule({ ...editingRule, multiplier: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={editingRule.is_active}
                  onCheckedChange={(checked) => setEditingRule({ ...editingRule, is_active: checked })}
                />
                <Label>Active</Label>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Effective reward: <strong>{editingRule.amount * editingRule.multiplier} UCoin</strong>
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRule(null)}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={() => editingRule && updateRule(editingRule)}>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Option Dialog */}
      <Dialog open={!!editingOption} onOpenChange={() => setEditingOption(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Spending Option</DialogTitle>
          </DialogHeader>
          {editingOption && (
            <div className="space-y-4">
              <div>
                <Label>Category</Label>
                <Input value={editingOption.category.replace(/_/g, ' ')} disabled />
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={editingOption.description || ''}
                  onChange={(e) => setEditingOption({ ...editingOption, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Cost (UCoin)</Label>
                  <Input
                    type="number"
                    value={editingOption.cost}
                    onChange={(e) => setEditingOption({ ...editingOption, cost: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Value</Label>
                  <Input
                    type="number"
                    value={editingOption.value}
                    onChange={(e) => setEditingOption({ ...editingOption, value: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Value Type</Label>
                  <Select
                    value={editingOption.value_type}
                    onValueChange={(val: 'percentage' | 'fixed' | 'boost') => 
                      setEditingOption({ ...editingOption, value_type: val })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                      <SelectItem value="boost">Boost Hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Minimum Balance Required</Label>
                <Input
                  type="number"
                  value={editingOption.min_balance}
                  onChange={(e) => setEditingOption({ ...editingOption, min_balance: Number(e.target.value) })}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={editingOption.is_active}
                  onCheckedChange={(checked) => setEditingOption({ ...editingOption, is_active: checked })}
                />
                <Label>Active</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingOption(null)}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={() => editingOption && updateOption(editingOption)}>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Rule Dialog */}
      <Dialog open={isAddingRule} onOpenChange={setIsAddingRule}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Earning Rule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Category (unique identifier)</Label>
              <Input
                placeholder="e.g., weekly_challenge"
                value={newRule.category}
                onChange={(e) => setNewRule({ ...newRule, category: e.target.value.toLowerCase().replace(/\s/g, '_') })}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                placeholder="e.g., Complete a weekly challenge"
                value={newRule.description}
                onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Base Amount</Label>
                <Input
                  type="number"
                  value={newRule.amount}
                  onChange={(e) => setNewRule({ ...newRule, amount: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Multiplier</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={newRule.multiplier}
                  onChange={(e) => setNewRule({ ...newRule, multiplier: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={newRule.is_active}
                onCheckedChange={(checked) => setNewRule({ ...newRule, is_active: checked })}
              />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddingRule(false)}>Cancel</Button>
            <Button onClick={addRule} disabled={!newRule.category}>Add Rule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Option Dialog */}
      <Dialog open={isAddingOption} onOpenChange={setIsAddingOption}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Spending Option</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Category (unique identifier)</Label>
              <Input
                placeholder="e.g., exclusive_discount"
                value={newOption.category}
                onChange={(e) => setNewOption({ ...newOption, category: e.target.value.toLowerCase().replace(/\s/g, '_') })}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                placeholder="e.g., Get an exclusive 15% discount"
                value={newOption.description}
                onChange={(e) => setNewOption({ ...newOption, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Cost (UCoin)</Label>
                <Input
                  type="number"
                  value={newOption.cost}
                  onChange={(e) => setNewOption({ ...newOption, cost: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Value</Label>
                <Input
                  type="number"
                  value={newOption.value}
                  onChange={(e) => setNewOption({ ...newOption, value: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Value Type</Label>
                <Select
                  value={newOption.value_type}
                  onValueChange={(val: 'percentage' | 'fixed' | 'boost') => 
                    setNewOption({ ...newOption, value_type: val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                    <SelectItem value="boost">Boost Hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={newOption.is_active}
                onCheckedChange={(checked) => setNewOption({ ...newOption, is_active: checked })}
              />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddingOption(false)}>Cancel</Button>
            <Button onClick={addOption} disabled={!newOption.category}>Add Option</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
