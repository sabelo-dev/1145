import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { 
  Coins, Rocket, Zap, BarChart3, Target, Clock, TrendingUp,
  Plus, Play, Pause, Eye, MousePointer, ShoppingCart
} from 'lucide-react';
import { PromoCredits, SponsoredPlacement, AutoCampaign } from '@/types/brand';
import { cn } from '@/lib/utils';

interface GrowthToolsProps {
  promoCredits: PromoCredits | null;
  placements: SponsoredPlacement[];
  campaigns: AutoCampaign[];
  onCreatePlacement: (type: string, cost: number, duration: number, productId?: string) => Promise<unknown>;
  onCreateCampaign: (type: string, conditions: Record<string, unknown>, actions: Record<string, unknown>, budget: number) => Promise<unknown>;
  onToggleCampaign?: (campaignId: string, active: boolean) => Promise<void>;
}

const placementOptions = [
  { type: 'homepage_featured', label: 'Homepage Featured', cost: 100, duration: 24, icon: Rocket },
  { type: 'category_top', label: 'Category Top', cost: 50, duration: 24, icon: TrendingUp },
  { type: 'search_boost', label: 'Search Boost', cost: 30, duration: 12, icon: Target },
  { type: 'banner', label: 'Banner Ad', cost: 150, duration: 48, icon: BarChart3 }
];

const campaignTypes = [
  { type: 'slow_day_boost', label: 'Slow Day Boost', description: 'Auto-boost when sales are low' },
  { type: 'weekend_special', label: 'Weekend Special', description: 'Run promotions on weekends' },
  { type: 'inventory_clear', label: 'Inventory Clearance', description: 'Discount overstocked items' }
];

export function GrowthTools({ 
  promoCredits, 
  placements, 
  campaigns, 
  onCreatePlacement,
  onCreateCampaign,
  onToggleCampaign
}: GrowthToolsProps) {
  const [showPlacementDialog, setShowPlacementDialog] = useState(false);
  const [showCampaignDialog, setShowCampaignDialog] = useState(false);
  const [selectedPlacement, setSelectedPlacement] = useState(placementOptions[0]);
  const [selectedCampaignType, setSelectedCampaignType] = useState(campaignTypes[0]);
  const [campaignBudget, setCampaignBudget] = useState(100);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreatePlacement = async () => {
    setIsCreating(true);
    await onCreatePlacement(
      selectedPlacement.type,
      selectedPlacement.cost,
      selectedPlacement.duration
    );
    setIsCreating(false);
    setShowPlacementDialog(false);
  };

  const handleCreateCampaign = async () => {
    setIsCreating(true);
    await onCreateCampaign(
      selectedCampaignType.type,
      { sales_below: 50 },
      { discount_percent: 10, boost_visibility: true },
      campaignBudget
    );
    setIsCreating(false);
    setShowCampaignDialog(false);
  };

  const activePlacements = placements.filter(p => p.status === 'active');
  const activeCampaigns = campaigns.filter(c => c.is_active);

  return (
    <div className="space-y-6">
      {/* Credits Balance */}
      <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-amber-500/20">
                <Coins className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Promo Credits</p>
                <p className="text-3xl font-bold">{promoCredits?.balance || 0}</p>
              </div>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <p>Earned: {promoCredits?.lifetime_earned || 0}</p>
              <p>Spent: {promoCredits?.lifetime_spent || 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="placements" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="placements" className="flex items-center gap-2">
            <Rocket className="h-4 w-4" />
            Sponsored Placements
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Auto Campaigns
          </TabsTrigger>
        </TabsList>

        <TabsContent value="placements" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Sponsored Placements</h3>
              <p className="text-sm text-muted-foreground">
                Boost your products visibility with paid placements
              </p>
            </div>
            <Button onClick={() => setShowPlacementDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Placement
            </Button>
          </div>

          {/* Placement Options Preview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {placementOptions.map((option) => {
              const Icon = option.icon;
              return (
                <Card 
                  key={option.type}
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => {
                    setSelectedPlacement(option);
                    setShowPlacementDialog(true);
                  }}
                >
                  <CardContent className="p-4 text-center">
                    <Icon className="h-8 w-8 mx-auto mb-2 text-primary" />
                    <p className="font-medium text-sm">{option.label}</p>
                    <p className="text-xs text-muted-foreground">{option.duration}h</p>
                    <Badge className="mt-2" variant="secondary">
                      {option.cost} credits
                    </Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Active Placements */}
          {activePlacements.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Active Placements</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {activePlacements.map((placement) => (
                    <div key={placement.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium">{placement.placement_type.replace(/_/g, ' ')}</p>
                        <p className="text-sm text-muted-foreground">
                          Ends: {new Date(placement.end_time).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Eye className="h-4 w-4" />
                          {placement.impressions}
                        </div>
                        <div className="flex items-center gap-1">
                          <MousePointer className="h-4 w-4" />
                          {placement.clicks}
                        </div>
                        <div className="flex items-center gap-1">
                          <ShoppingCart className="h-4 w-4" />
                          {placement.conversions}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="campaigns" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Auto Campaigns</h3>
              <p className="text-sm text-muted-foreground">
                Set up automated promotions based on triggers
              </p>
            </div>
            <Button onClick={() => setShowCampaignDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Campaign
            </Button>
          </div>

          {/* Campaign Types */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {campaignTypes.map((type) => (
              <Card 
                key={type.type}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => {
                  setSelectedCampaignType(type);
                  setShowCampaignDialog(true);
                }}
              >
                <CardContent className="p-4">
                  <Zap className="h-6 w-6 mb-2 text-primary" />
                  <p className="font-medium">{type.label}</p>
                  <p className="text-sm text-muted-foreground">{type.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Active Campaigns */}
          {campaigns.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Your Campaigns</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {campaigns.map((campaign) => (
                    <div key={campaign.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "p-2 rounded-full",
                          campaign.is_active ? "bg-green-100 text-green-600" : "bg-muted text-muted-foreground"
                        )}>
                          {campaign.is_active ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                        </div>
                        <div>
                          <p className="font-medium">{campaign.campaign_type.replace(/_/g, ' ')}</p>
                          <p className="text-sm text-muted-foreground">
                            {campaign.credits_used}/{campaign.credit_budget} credits used • {campaign.trigger_count} triggers
                          </p>
                        </div>
                      </div>
                      <Switch 
                        checked={campaign.is_active}
                        onCheckedChange={(checked) => onToggleCampaign?.(campaign.id, checked)}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Placement Dialog */}
      <Dialog open={showPlacementDialog} onOpenChange={setShowPlacementDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Sponsored Placement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Placement Type</Label>
              <Select 
                value={selectedPlacement.type}
                onValueChange={(v) => setSelectedPlacement(placementOptions.find(p => p.type === v)!)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {placementOptions.map((option) => (
                    <SelectItem key={option.type} value={option.type}>
                      {option.label} - {option.cost} credits
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex justify-between mb-2">
                <span>Duration:</span>
                <span className="font-medium">{selectedPlacement.duration} hours</span>
              </div>
              <div className="flex justify-between">
                <span>Cost:</span>
                <span className="font-bold text-amber-600">{selectedPlacement.cost} credits</span>
              </div>
            </div>
            {(promoCredits?.balance || 0) < selectedPlacement.cost && (
              <p className="text-sm text-red-500">Insufficient credits</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPlacementDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleCreatePlacement}
              disabled={isCreating || (promoCredits?.balance || 0) < selectedPlacement.cost}
            >
              {isCreating ? 'Creating...' : 'Create Placement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Campaign Dialog */}
      <Dialog open={showCampaignDialog} onOpenChange={setShowCampaignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Auto Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Campaign Type</Label>
              <Select 
                value={selectedCampaignType.type}
                onValueChange={(v) => setSelectedCampaignType(campaignTypes.find(c => c.type === v)!)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {campaignTypes.map((type) => (
                    <SelectItem key={type.type} value={type.type}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-1">{selectedCampaignType.description}</p>
            </div>
            <div>
              <Label>Credit Budget</Label>
              <Input 
                type="number" 
                value={campaignBudget}
                onChange={(e) => setCampaignBudget(parseInt(e.target.value) || 0)}
                min={10}
                max={promoCredits?.balance || 0}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Available: {promoCredits?.balance || 0} credits
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCampaignDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleCreateCampaign}
              disabled={isCreating || campaignBudget <= 0}
            >
              {isCreating ? 'Creating...' : 'Create Campaign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
