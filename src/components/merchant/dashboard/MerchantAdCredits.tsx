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
import { submitPayFastForm } from "@/lib/payments";
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
  { value: "product_boost", label: "Store Boost", icon: TrendingUp, description: "Your products are listed ahead of others in the shop and in search, marked Sponsored", cost: 10 },
  { value: "featured_listing", label: "Featured Listing", icon: Star, description: "Store Boost, plus your products lead the Featured section on the home page", cost: 25 },
  { value: "flash_promotion", label: "Flash Promotion", icon: Zap, description: "The same as Featured Listing; choose a short duration for a burst", cost: 30 },
  // Older campaigns of these types still run as a Store Boost.
  { value: "search_promotion", label: "Search Promotion", icon: Search, description: "Runs as a Store Boost", cost: 15, retired: true },
  { value: "banner_ad", label: "Banner Ad", icon: Eye, description: "Runs as a Store Boost", cost: 50, retired: true },
];

const MerchantAdCredits = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [credits, setCredits] = useState<PromoCredits | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [monthlyAllowance, setMonthlyAllowance] = useState(0);
  const [merchantTier, setMerchantTier] = useState("starter");
  const [packs, setPacks] = useState<Array<{ id: string; credits: number; price: number }>>([]);
  const [buyingPack, setBuyingPack] = useState<string | null>(null);

  // Back from PayFast after buying credits. The balance updates when PayFast
  // confirms the payment, which can take a moment.
  useEffect(() => {
    const outcome = new URLSearchParams(window.location.search).get("credits");
    if (outcome === "success") {
      toast({ title: "Payment received", description: "Your credits are added as soon as PayFast confirms the payment. Refresh if the balance has not changed in a minute." });
    } else if (outcome === "cancelled") {
      toast({ title: "Payment cancelled", description: "No credits were bought." });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buyPack = async (packId: string) => {
    setBuyingPack(packId);
    try {
      const { data, error } = await supabase.functions.invoke("ad-credits-purchase", {
        body: { pack_id: packId, origin: window.location.origin },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await submitPayFastForm(data.paymentUrl, data.formData);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Purchase not started", description: error?.message || "Something went wrong" });
      setBuyingPack(null);
    }
  };

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
      const { data: merchant } = await supabase
        .from("merchants")
        .select("id, ad_credits, subscription_tier")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (!merchant) return;
      setMerchantId(merchant.id);
      setMerchantTier(merchant.subscription_tier || "starter");

      const allowance = merchant.subscription_tier === "gold" ? 500 :
        merchant.subscription_tier === "silver" ? 250 :
        merchant.subscription_tier === "bronze" ? 100 : 0;
      setMonthlyAllowance(allowance);

      // The database adds this month's plan allowance to the balance if it has
      // not been added yet, and returns the balance.
      const { data: creditData, error: creditError } = await (supabase.rpc as any)("merchant_ad_credits_sync");
      if (creditError) throw creditError;
      setCredits(creditData);

      // Fetch transactions
      const { data: txData } = await supabase
        .from("promo_credit_transactions")
        .select("*")
        .eq("merchant_id", merchant.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setTransactions(txData || []);

      // Fetch campaigns
      const { data: campData } = await supabase
        .from("auto_campaigns")
        .select("*")
        .eq("merchant_id", merchant.id)
        .order("created_at", { ascending: false });
      setCampaigns(campData || []);

      // Credit packs on sale
      const { data: packData } = await (supabase.from as any)("ad_credit_packs")
        .select("id, credits, price")
        .eq("is_active", true)
        .order("credits");
      setPacks((packData || []).map((p: any) => ({ id: p.id, credits: p.credits, price: Number(p.price) })));
    } catch (error) {
      console.error("Error fetching ad credits data:", error);
    } finally {
      setLoading(false);
    }
  };

  const createCampaign = async () => {
    if (!merchantId || !campaignForm.type || !campaignForm.budget) {
      toast({ variant: "destructive", title: "Error", description: "Please fill in all required fields" });
      return;
    }

    const budget = parseInt(campaignForm.budget);
    if (budget <= 0 || (credits && budget > credits.balance)) {
      toast({ variant: "destructive", title: "Error", description: "Insufficient credits or invalid budget" });
      return;
    }

    try {
      // The database takes the budget from the balance and creates the campaign together.
      const { error } = await (supabase.rpc as any)("merchant_ad_campaign_create", {
        p_type: campaignForm.type,
        p_budget: budget,
        p_duration_days: parseInt(campaignForm.duration),
        p_keywords: campaignForm.keywords ? campaignForm.keywords.split(",").map(k => k.trim()).filter(Boolean) : [],
        p_product_id: campaignForm.targetProduct || "",
      });

      if (error) throw error;

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
      // Pausing returns the unused budget to the balance; resuming takes it back.
      const { error } = await (supabase.rpc as any)("merchant_ad_campaign_update", {
        p_campaign_id: campaign.id,
        p_action: campaign.is_active ? "pause" : "resume",
      });
      if (error) throw error;

      toast({ title: campaign.is_active ? "Campaign paused" : "Campaign resumed" });
      await fetchData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error?.message || "Failed to update campaign" });
    }
  };

  const deleteCampaign = async (campaign: AdCampaign) => {
    try {
      // A paused campaign's unused budget was already returned when it was paused.
      const refund = campaign.is_active ? campaign.credit_budget - campaign.credits_used : 0;

      const { error } = await (supabase.rpc as any)("merchant_ad_campaign_update", {
        p_campaign_id: campaign.id,
        p_action: "delete",
      });
      if (error) throw error;

      toast({ title: "Campaign deleted", description: refund > 0 ? `${refund} credits refunded.` : undefined });
      await fetchData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error?.message || "Failed to delete campaign" });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  const activeCampaigns = campaigns.filter(c => c.is_active).length;
  const totalSpent = campaigns.reduce((sum, c) => sum + c.credits_used, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
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
            <p className="text-xs text-muted-foreground">
              <span className="capitalize">{merchantTier}</span> plan
              {monthlyAllowance > 0 && credits?.last_monthly_grant
                ? `, added ${new Date(credits.last_monthly_grant).toLocaleDateString()}`
                : ""}
            </p>
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

      <Card className="border-dashed border-primary/30 bg-primary/5">
        <CardContent className="py-4 space-y-2 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">How ad credits work</p>
          <p>
            <strong>Getting credits:</strong> your plan adds credits to your balance once a month: Bronze 100, Silver 250, Gold 500.
            {monthlyAllowance > 0
              ? ` Your ${monthlyAllowance} credits are added automatically, and unused credits carry over to the next month.`
              : " Your current plan has no monthly credits; upgrade your subscription to receive them."}
          </p>
          <p>
            <strong>Using credits:</strong> choose Create Campaign and set a budget and a number of days. While it runs, your
            products are listed ahead of others and marked Sponsored. The budget leaves your balance straight away and is used
            in equal parts each day; pausing or deleting a campaign returns the part it has not used.
          </p>
          {packs.length > 0 && (
            <div className="pt-1">
              <p>
                <strong>Buying more:</strong> pay once by card through PayFast; the credits are added to your balance when the payment is confirmed and do not expire.
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {packs.map((pack) => (
                  <Button
                    key={pack.id}
                    variant="outline"
                    size="sm"
                    disabled={buyingPack !== null}
                    onClick={() => buyPack(pack.id)}
                  >
                    {buyingPack === pack.id ? "Opening PayFast..." : `${pack.credits} credits for R${pack.price.toFixed(2)}`}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
                    <div className="header-row">
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
                      <div className="grid grid-cols-3 gap-2 sm:gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Days run</p>
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
                  {CAMPAIGN_TYPES.filter((type) => !type.retired).map((type) => (
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

export default MerchantAdCredits;
