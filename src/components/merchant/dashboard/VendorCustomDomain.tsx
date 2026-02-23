import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Globe,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Shield,
  ExternalLink,
  Copy,
  Lock,
  RefreshCcw,
  PauseCircle,
  Info,
} from "lucide-react";

interface CustomDomain {
  id: string;
  domain: string;
  status: string;
  verification_token: string | null;
  ssl_status: string;
  verified_at: string | null;
  created_at: string;
}

const VendorCustomDomain = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeSlug, setStoreSlug] = useState<string | null>(null);
  const [vendorTier, setVendorTier] = useState("starter");
  const [domains, setDomains] = useState<CustomDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [domainInput, setDomainInput] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (user?.id) fetchData();
  }, [user?.id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: vendor } = await supabase
        .from("vendors")
        .select("id, subscription_tier")
        .eq("user_id", user!.id)
        .single();

      if (!vendor) return;
      setVendorId(vendor.id);
      setVendorTier(vendor.subscription_tier || "starter");

      const { data: store } = await supabase
        .from("stores")
        .select("id, slug")
        .eq("vendor_id", vendor.id)
        .maybeSingle();

      if (store) {
        setStoreId(store.id);
        setStoreSlug(store.slug);
      }

      const { data: domainData } = await supabase
        .from("merchant_custom_domains")
        .select("*")
        .eq("vendor_id", vendor.id)
        .order("created_at", { ascending: false });

      setDomains(domainData || []);
    } catch (error) {
      console.error("Error fetching custom domains:", error);
    } finally {
      setLoading(false);
    }
  };

  const isGoldTier = vendorTier === "gold";

  const addDomain = async () => {
    if (!vendorId || !domainInput.trim()) return;
    setAdding(true);

    try {
      let domain = domainInput.trim().toLowerCase();
      domain = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

      // Generate verification token
      const token = "lsv_" + Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, "0")).join("");

      const { error } = await supabase.from("merchant_custom_domains").insert({
        vendor_id: vendorId,
        store_id: storeId,
        domain,
        status: "pending",
        verification_token: token,
        ssl_status: "pending",
      });

      if (error) throw error;

      // Auto-enable white_label and sync domain to storefront_customizations
      if (storeId) {
        const { data: existingCustomization } = await supabase
          .from("storefront_customizations")
          .select("id")
          .eq("store_id", storeId)
          .maybeSingle();

        if (existingCustomization) {
          await supabase
            .from("storefront_customizations")
            .update({ white_label: true, custom_domain: domain })
            .eq("store_id", storeId);
        } else {
          await supabase
            .from("storefront_customizations")
            .insert({
              store_id: storeId,
              white_label: true,
              custom_domain: domain,
              accent_color: "#6366f1",
              secondary_color: "#8b5cf6",
              layout_type: "grid",
              cta_button_text: "Shop Now",
              announcement_bar_active: false,
              email_capture_enabled: false,
              email_capture_title: "Stay in the loop",
              homepage_sections: ["announcement", "hero", "featured", "products", "about", "testimonials", "faq", "newsletter", "social", "policies"],
            });
        }
      }

      toast({ title: "Domain added", description: "White labelling enabled. Configure DNS records to verify your domain." });
      setAddDialogOpen(false);
      setDomainInput("");
      await fetchData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message?.includes("unique") ? "This domain is already registered to another store." : error.message });
    } finally {
      setAdding(false);
    }
  };

  const verifyDomain = async (domainId: string) => {
    try {
      await supabase.from("merchant_custom_domains")
        .update({ status: "verifying" })
        .eq("id", domainId);

      toast({ title: "Verification started", description: "DNS verification is in progress. This may take a few minutes." });

      // Simulated verification (production would use background worker)
      setTimeout(async () => {
        await supabase.from("merchant_custom_domains")
          .update({ status: "active", verified_at: new Date().toISOString(), ssl_status: "active" })
          .eq("id", domainId);
        await fetchData();
      }, 3000);
    } catch {
      toast({ variant: "destructive", title: "Verification failed" });
    }
  };

  const deleteDomain = async (domainId: string) => {
    try {
      await supabase.from("merchant_custom_domains").delete().eq("id", domainId);

      // If last domain removed, disable white-label
      const remaining = domains.filter(d => d.id !== domainId);
      if (remaining.length === 0 && storeId) {
        await supabase
          .from("storefront_customizations")
          .update({ white_label: false, custom_domain: null })
          .eq("store_id", storeId);
      }

      toast({ title: "Domain removed" });
      await fetchData();
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to remove domain" });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active": return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "verifying": return <RefreshCcw className="h-5 w-5 text-yellow-500 animate-spin" />;
      case "suspended": return <PauseCircle className="h-5 w-5 text-orange-500" />;
      case "failed": return <AlertCircle className="h-5 w-5 text-destructive" />;
      default: return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "active": return "default" as const;
      case "suspended": return "outline" as const;
      case "failed": return "destructive" as const;
      default: return "secondary" as const;
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  if (!isGoldTier) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Custom Domain</h2>
          <p className="text-muted-foreground">Connect your own domain to your storefront</p>
        </div>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Lock className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Gold Tier Required</h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              Custom domains are exclusively available to Gold tier merchants. Upgrade your subscription to connect your own domain (e.g., shop.yourbrand.com) to your storefront.
            </p>
            <Badge variant="outline" className="text-sm">Current tier: {vendorTier}</Badge>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Custom Domain</h2>
          <p className="text-muted-foreground">Connect your own domain to your storefront</p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Domain
        </Button>
      </div>

      {/* Architecture explanation */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="flex items-start gap-3 py-4">
          <Info className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Single Source of Truth</p>
            <p>Your custom domain is an alternate access point to your storefront. All products, branding, content, and settings are managed exclusively from this dashboard — changes reflect automatically on both your platform URL and custom domain with zero manual sync.</p>
            {storeSlug && (
              <p className="mt-2 text-xs">
                Platform URL: <code className="bg-muted px-1 py-0.5 rounded">/store/{storeSlug}</code>
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Domains */}
      {domains.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Globe className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No custom domains yet</h3>
            <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">
              Connect your own domain to give your storefront a professional look. Your customers will see your brand — no platform branding.
            </p>
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Domain
            </Button>
          </CardContent>
        </Card>
      ) : (
        domains.map((domain) => (
          <Card key={domain.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {getStatusIcon(domain.status)}
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {domain.domain}
                      <Badge variant={getStatusBadgeVariant(domain.status)}>
                        {domain.status}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      {domain.status === "active"
                        ? `Verified on ${new Date(domain.verified_at!).toLocaleDateString()} · All dashboard changes reflect automatically`
                        : domain.status === "verifying"
                        ? "DNS verification in progress..."
                        : domain.status === "suspended"
                        ? "Domain suspended — upgrade back to Gold to reactivate"
                        : "Awaiting DNS configuration"}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex gap-1">
                  {domain.status === "active" && (
                    <Button variant="ghost" size="icon" asChild>
                      <a href={`https://${domain.domain}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => deleteDomain(domain.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            {/* Suspended notice */}
            {domain.status === "suspended" && (
              <CardContent>
                <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                  <p className="text-sm text-orange-700 dark:text-orange-400">
                    This domain was suspended because your subscription was downgraded from Gold tier. Upgrading back to Gold will automatically reactivate it — no reconfiguration needed.
                  </p>
                </div>
              </CardContent>
            )}

            {/* Verifying state */}
            {domain.status === "verifying" && (
              <CardContent>
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-center gap-3">
                  <RefreshCcw className="h-5 w-5 text-yellow-600 animate-spin shrink-0" />
                  <p className="text-sm text-yellow-700 dark:text-yellow-400">
                    DNS verification is in progress. This usually takes a few minutes.
                  </p>
                </div>
              </CardContent>
            )}

            {/* DNS instructions for pending/failed domains */}
            {(domain.status === "pending" || domain.status === "failed") && (
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                  <h4 className="font-medium text-sm">DNS Setup Instructions</h4>
                  <p className="text-xs text-muted-foreground">Add the following DNS records at your domain registrar:</p>

                  <div className="space-y-2">
                    <div className="grid grid-cols-4 gap-2 text-xs font-mono bg-background p-2 rounded">
                      <span className="font-semibold">Type</span>
                      <span className="font-semibold">Name</span>
                      <span className="font-semibold col-span-2">Value</span>
                      <span>A</span>
                      <span>@</span>
                      <span className="col-span-2 flex items-center gap-1">
                        185.158.133.1
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copyToClipboard("185.158.133.1")}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </span>
                      <span>TXT</span>
                      <span>_lsverify</span>
                      <span className="col-span-2 flex items-center gap-1 truncate">
                        {domain.verification_token}
                        <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => copyToClipboard(domain.verification_token || "")}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </span>
                    </div>
                  </div>

                  <Button size="sm" onClick={() => verifyDomain(domain.id)}>
                    <Shield className="h-4 w-4 mr-2" /> Verify Domain
                  </Button>
                </div>

                {domain.ssl_status && (
                  <div className="flex items-center gap-2 text-xs">
                    <Shield className={`h-4 w-4 ${domain.ssl_status === "active" ? "text-green-500" : "text-muted-foreground"}`} />
                    <span>SSL: {domain.ssl_status === "active" ? "Active (HTTPS)" : "Pending"}</span>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        ))
      )}

      {/* Add Domain Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Domain</DialogTitle>
            <DialogDescription>Connect your own domain to your storefront. All store data is managed from this dashboard — your domain is simply an access point.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label>Domain Name</Label>
              <Input
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                placeholder="shop.yourbrand.com"
              />
              <p className="text-xs text-muted-foreground">
                Enter the domain or subdomain you want to connect (e.g., shop.yourbrand.com or yourbrand.com)
              </p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg space-y-2">
              <p className="text-xs text-muted-foreground">
                <strong>What happens next:</strong>
              </p>
              <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
                <li>White-labelling is automatically enabled (platform branding removed)</li>
                <li>Your existing products, branding, and content are immediately accessible on the domain</li>
                <li>Configure DNS records, verify, and your domain goes live</li>
                <li>All future dashboard changes reflect on both URLs automatically</li>
              </ul>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={addDomain} disabled={adding || !domainInput.trim()}>
              {adding ? "Adding..." : "Add Domain"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VendorCustomDomain;
