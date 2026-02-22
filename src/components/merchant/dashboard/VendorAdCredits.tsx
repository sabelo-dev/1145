import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Coins,
  TrendingUp,
  Megaphone,
  Search,
  Star,
  Eye,
  Zap,
  Plus,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Pause,
  Play,
  Trash2,
} from "lucide-react";

interface PromoCredits {
  id: string;
  balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
  last_monthly_grant: string | null;
}

interface CreditTransaction {
  id: string;
  amount: number;
  type: string;
  category: string;
  description: string;
  reference_id: string | null;
  created_at: string;
}

interface AdCampaign {
  id: string;
  campaign_type: string;
  trigger_conditions: any;
  action_config: any;
  credit_budget: number;
  credits_used: number;
  is_active: boolean;
  trigger_count: number;
  created_at: string;
}

const CAMPAIGN_TYPES = [
  { value: "product_boost", label: "Product Boost", icon: TrendingUp, description: "Boost product visibility in search results", cost: 10 },
  { value: "featured_listing", label: "Featured Listing", icon: Star, description: "Feature a product on the homepage or category page", cost: 25 },
  { value: "search_promotion", label: "Search Promotion", icon: Search, description: "Promote products in search results for specific keywords", cost: 15 },
  { value: "banner_ad", label: "Banner Ad", icon: Eye, description: "Display a banner ad on high-traffic pages", cost: 50 },
  { value: "flash_promotion", label: "Flash Promotion", icon: Zap, description: "Short-term high-visibility promotion", cost: 30 },
];

const VendorAdCredits = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [credits, setCredits] = useState<PromoCredits | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [monthlyAllowance, setMonthlyAllowance] = useState(0);
  const [vendorTier, setVendorTier] = useState("starter");

  // Campaign form
  const [campaignForm, setCampaignForm] = useState({
    type: "",
    budget: "",
    duration: "7",
    targetProduct: "",
    keywords: "",
  });

  useEffect(() => {
    if (user?.id) fetchData();
  }, [user?.id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: vendor } = await supabase
        .from("vendors")
        .select("id, ad_credits, subscription_tier")
        .eq("user_id", user!.id)
        .single();

      if (!vendor) return;
      setVendorId(vendor.id);
      setVendorTier(vendor.subscription_tier || "starter");

      const allowance = vendor.subscription_tier === "gold" ? 500 :
        vendor.subscription_tier === "silver" ? 250 :
        vendor.subscription_tier === "bronze" ? 100 : 0;
      setMonthlyAllowance(allowance);

      // Fetch promo credits
      const { data: creditData } = await supabase
        .from("promo_credits")
        .select("*")
        .eq("vendor_id", vendor.id)
        .maybeSingle();

      if (creditData) {
        setCredits(creditData);
      } else {
        // Create initial credit record
        const { data: newCredits } = await supabase
          .from("promo_credits")
          .insert({ vendor_id: vendor.id, balance: 0, lifetime_earned: 0, lifetime_spent: 0 })
          .select()
          .single();
        setCredits(newCredits);
      }

      // Fetch transactions
      const { data: txData } = await supabase
        .from("promo_credit_transactions")
        .select("*")
        .eq("vendor_id", vendor.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setTransactions(txData || []);

      // Fetch campaigns
      const { data: campData } = await supabase
        .from("auto_campaigns")
        .select("*")
        .eq("vendor_id", vendor.id)
        .order("created_at", { ascending: false });
      setCampaigns(campData || []);
    } catch (error) {
      console.error("Error fetching ad credits data:", error);
    } finally {
      setLoading(false);
    }
  };

  const createCampaign = async () => {
    if (!vendorId || !campaignForm.type || !campaignForm.budget) {
      toast({ variant: "destructive", title: "Error", description: "Please fill in all required fields" });
      return;
    }

    const budget = parseInt(campaignForm.budget);
    if (budget <= 0 || (credits && budget > credits.balance)) {
      toast({ variant: "destructive", title: "Error", description: "Insufficient credits or invalid budget" });
      return;
    }

    try {
      // Get store
      const { data: store } = await supabase
        .from("stores")
        .select("id")
        .eq("vendor_id", vendorId)
        .single();

      const { error } = await supabase.from("auto_campaigns").insert({
        vendor_id: vendorId,
        store_id: store?.id || null,
        campaign_type: campaignForm.type,
        trigger_conditions: {
          duration_days: parseInt(campaignForm.duration),
          keywords: campaignForm.keywords ? campaignForm.keywords.split(",").map(k => k.trim()) : [],
          product_id: campaignForm.targetProduct || null,
        },
        action_config: {
          boost_type: campaignForm.type,
          started_at: new Date().toISOString(),
        },
        credit_budget: budget,
        credits_used: 0,
        is_active: true,
      });

      if (error) throw error;

      // Deduct credits
      await supabase.from("promo_credits")
        .update({ balance: (credits?.balance || 0) - budget, lifetime_spent: (credits?.lifetime_spent || 0) + budget })
        .eq("vendor_id", vendorId);

      // Log transaction
      await supabase.from("promo_credit_transactions").insert({
        vendor_id: vendorId,
        amount: -budget,
        type: "spend",
        category: campaignForm.type,
        description: `Campaign: ${CAMPAIGN_TYPES.find(c => c.value === campaignForm.type)?.label || campaignForm.type}`,
      });

      toast({ title: "Campaign created", description: `${budget} credits allocated to your new campaign.` });
      setCreateDialogOpen(false);
      setCampaignForm({ type: "", budget: "", duration: "7", targetProduct: "", keywords: "" });
      await fetchData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to create campaign" });
    }
  };

  const toggleCampaign = async (campaign: AdCampaign) => {
    try {
      await supabase.from("auto_campaigns")
        .update({ is_active: !campaign.is_active })
        .eq("id", campaign.id);

      if (campaign.is_active) {
        // Refund remaining credits
        const refund = campaign.credit_budget - campaign.credits_used;
        if (refund > 0) {
          await supabase.from("promo_credits")
            .update({ balance: (credits?.balance || 0) + refund })
            .eq("vendor_id", vendorId!);

          await supabase.from("promo_credit_transactions").insert({
            vendor_id: vendorId!,
            amount: refund,
            type: "refund",
            category: campaign.campaign_type,
            description: `Refund: Paused ${campaign.campaign_type} campaign`,
          });
        }
      }

      toast({ title: campaign.is_active ? "Campaign paused" : "Campaign resumed" });
      await fetchData();
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to update campaign" });
    }
  };

  const deleteCampaign = async (campaign: AdCampaign) => {
    try {
      const refund = campaign.credit_budget - campaign.credits_used;

      await supabase.from("auto_campaigns").delete().eq("id", campaign.id);

      if (refund > 0) {
        await supabase.from("promo_credits")
          .update({ balance: (credits?.balance || 0) + refund })
          .eq("vendor_id", vendorId!);

        await supabase.from("promo_credit_transactions").insert({
          vendor_id: vendorId!,
          amount: refund,
          type: "refund",
          category: campaign.campaign_type,
          description: `Refund: Deleted ${campaign.campaign_type} campaign`,
        });
      }

      toast({ title: "Campaign deleted", description: refund > 0 ? `${refund} credits refunded.` : undefined });
      await fetchData();
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete campaign" });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  const activeCampaigns = campaigns.filter(c => c.is_active).length;
  const totalSpent = campaigns.reduce((sum, c) => sum + c.credits_used, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Ad Credits</h2>
          <p className="text-muted-foreground">Manage your advertising budget and campaigns</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} disabled={!credits || credits.balance <= 0}>
          <Plus className="h-4 w-4 mr-2" />
          Create Campaign
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Credit Balance</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{credits?.balance || 0}</div>
            <p className="text-xs text-muted-foreground">credits available</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Allowance</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monthlyAllowance}</div>
            <p className="text-xs text-muted-foreground capitalize">{vendorTier} tier</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
            <Megaphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCampaigns}</div>
            <p className="text-xs text-muted-foreground">running now</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{credits?.lifetime_spent || 0}</div>
            <p className="text-xs text-muted-foreground">all time</p>
          </CardContent>
        </Card>
      </div>

      {vendorTier === "starter" && (
        <Card className="border-dashed border-primary/30 bg-primary/5">
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">
              <strong>Tip:</strong> Upgrade your subscription to receive monthly ad credits. Bronze gets 100/mo, Silver gets 250/mo, and Gold gets 500/mo.
            </p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="campaigns">
        <TabsList>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="history">Transaction History</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="space-y-4">
          {campaigns.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Megaphone className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">No campaigns yet</p>
                <p className="text-sm text-muted-foreground mb-4">Create your first ad campaign to boost your products.</p>
                <Button onClick={() => setCreateDialogOpen(true)} disabled={!credits || credits.balance <= 0}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Campaign
                </Button>
              </CardContent>
            </Card>
          ) : (
            campaigns.map((campaign) => {
              const typeInfo = CAMPAIGN_TYPES.find(t => t.value === campaign.campaign_type);
              const Icon = typeInfo?.icon || Megaphone;
              const budgetUsedPercent = campaign.credit_budget > 0
                ? Math.round((campaign.credits_used / campaign.credit_budget) * 100)
                : 0;

              return (
                <Card key={campaign.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-md bg-primary/10">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            {typeInfo?.label || campaign.campaign_type}
                            <Badge variant={campaign.is_active ? "default" : "secondary"}>
                              {campaign.is_active ? "Active" : "Paused"}
                            </Badge>
                          </CardTitle>
                          <CardDescription>{typeInfo?.description}</CardDescription>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => toggleCampaign(campaign)}>
                          {campaign.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteCampaign(campaign)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Budget Used</span>
                        <span className="font-medium">{campaign.credits_used} / {campaign.credit_budget} credits</span>
                      </div>
                      <Progress value={budgetUsedPercent} />
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Triggers</p>
                          <p className="font-medium">{campaign.trigger_count}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Duration</p>
                          <p className="font-medium">{campaign.trigger_conditions?.duration_days || "∞"} days</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Created</p>
                          <p className="font-medium">{new Date(campaign.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {transactions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No transactions yet
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-full ${tx.amount > 0 ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"}`}>
                          {tx.amount > 0 ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{tx.description}</p>
                          <p className="text-xs text-muted-foreground capitalize">{tx.category}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${tx.amount > 0 ? "text-green-600" : "text-destructive"}`}>
                          {tx.amount > 0 ? "+" : ""}{tx.amount} credits
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(tx.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Campaign Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Ad Campaign</DialogTitle>
            <DialogDescription>
              Spend your ad credits to promote your products. Available: {credits?.balance || 0} credits
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Campaign Type *</Label>
              <Select value={campaignForm.type} onValueChange={(v) => setCampaignForm({ ...campaignForm, type: v })}>
                <SelectTrigger><SelectValue placeholder="Select campaign type" /></SelectTrigger>
                <SelectContent>
                  {CAMPAIGN_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <span>{type.label}</span>
                        <span className="text-xs text-muted-foreground">({type.cost}+ credits)</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Credit Budget *</Label>
                <Input
                  type="number"
                  value={campaignForm.budget}
                  onChange={(e) => setCampaignForm({ ...campaignForm, budget: e.target.value })}
                  placeholder="e.g. 50"
                  min="1"
                  max={credits?.balance || 0}
                />
              </div>
              <div className="grid gap-2">
                <Label>Duration (days)</Label>
                <Select value={campaignForm.duration} onValueChange={(v) => setCampaignForm({ ...campaignForm, duration: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 days</SelectItem>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="14">14 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Keywords (comma-separated, optional)</Label>
              <Input
                value={campaignForm.keywords}
                onChange={(e) => setCampaignForm({ ...campaignForm, keywords: e.target.value })}
                placeholder="e.g. summer, fashion, sale"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={createCampaign}>Create Campaign</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VendorAdCredits;
