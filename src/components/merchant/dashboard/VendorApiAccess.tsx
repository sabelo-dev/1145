import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Key,
  Copy,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Shield,
  Activity,
  Clock,
  Code,
  BookOpen,
  Lock,
} from "lucide-react";

interface ApiKey {
  id: string;
  api_key: string;
  name: string;
  is_active: boolean;
  scopes: string[];
  rate_limit_per_hour: number;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

const AVAILABLE_SCOPES = [
  { value: "read:products", label: "Read Products", description: "View product catalog" },
  { value: "write:products", label: "Write Products", description: "Create/update products" },
  { value: "read:orders", label: "Read Orders", description: "View order details" },
  { value: "write:orders", label: "Update Orders", description: "Update order status" },
  { value: "read:inventory", label: "Read Inventory", description: "View stock levels" },
  { value: "write:inventory", label: "Update Inventory", description: "Update stock levels" },
  { value: "read:analytics", label: "Read Analytics", description: "Access analytics data" },
  { value: "read:customers", label: "Read Customers", description: "View customer data" },
];

const API_ENDPOINTS = [
  { method: "GET", path: "/api/v1/products", description: "List all products", scope: "read:products" },
  { method: "POST", path: "/api/v1/products", description: "Create a product", scope: "write:products" },
  { method: "PUT", path: "/api/v1/products/:id", description: "Update a product", scope: "write:products" },
  { method: "GET", path: "/api/v1/orders", description: "List all orders", scope: "read:orders" },
  { method: "PUT", path: "/api/v1/orders/:id/status", description: "Update order status", scope: "write:orders" },
  { method: "GET", path: "/api/v1/inventory", description: "Get stock levels", scope: "read:inventory" },
  { method: "PUT", path: "/api/v1/inventory/:sku", description: "Update stock", scope: "write:inventory" },
  { method: "GET", path: "/api/v1/analytics/sales", description: "Sales analytics", scope: "read:analytics" },
];

const VendorApiAccess = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [vendorTier, setVendorTier] = useState("starter");
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});

  // Create form
  const [keyName, setKeyName] = useState("Default");
  const [selectedScopes, setSelectedScopes] = useState<string[]>(["read:products", "read:orders"]);
  const [rateLimit, setRateLimit] = useState("1000");

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

      const { data: keys } = await supabase
        .from("merchant_api_keys")
        .select("*")
        .eq("vendor_id", vendor.id)
        .order("created_at", { ascending: false });

      setApiKeys(keys || []);
    } catch (error) {
      console.error("Error fetching API keys:", error);
    } finally {
      setLoading(false);
    }
  };

  const isGoldTier = vendorTier === "gold";

  const generateKey = async () => {
    if (!vendorId || !isGoldTier) return;

    try {
      // Generate key client-side (in production, do this server-side)
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      let apiKey = "mk_live_";
      for (let i = 0; i < 32; i++) apiKey += chars.charAt(Math.floor(Math.random() * chars.length));

      const apiSecret = "sk_" + Array.from(crypto.getRandomValues(new Uint8Array(24)), b => b.toString(16).padStart(2, "0")).join("");

      const { error } = await supabase.from("merchant_api_keys").insert({
        vendor_id: vendorId,
        api_key: apiKey,
        api_secret_hash: apiSecret, // In production, hash this
        name: keyName,
        scopes: selectedScopes,
        rate_limit_per_hour: parseInt(rateLimit),
        is_active: true,
      });

      if (error) throw error;

      toast({
        title: "API key created",
        description: "Your new API key has been generated. Make sure to copy the secret — it won't be shown again.",
      });

      setCreateDialogOpen(false);
      setKeyName("Default");
      setSelectedScopes(["read:products", "read:orders"]);
      await fetchData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  const toggleKeyActive = async (key: ApiKey) => {
    await supabase.from("merchant_api_keys").update({ is_active: !key.is_active }).eq("id", key.id);
    toast({ title: key.is_active ? "API key disabled" : "API key enabled" });
    await fetchData();
  };

  const deleteKey = async (keyId: string) => {
    await supabase.from("merchant_api_keys").delete().eq("id", keyId);
    toast({ title: "API key deleted" });
    await fetchData();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const toggleReveal = (keyId: string) => {
    setRevealedKeys((prev) => ({ ...prev, [keyId]: !prev[keyId] }));
  };

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  if (!isGoldTier) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">API Access</h2>
          <p className="text-muted-foreground">Integrate with our platform programmatically</p>
        </div>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Lock className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Gold Tier Required</h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              API access is exclusively available to Gold tier merchants. Upgrade your subscription to unlock programmatic access to products, orders, inventory, and analytics.
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
          <h2 className="text-2xl font-bold tracking-tight">API Access</h2>
          <p className="text-muted-foreground">Manage API keys and integrate with our platform</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create API Key
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Keys</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{apiKeys.filter(k => k.is_active).length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rate Limit</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,000</div>
            <p className="text-xs text-muted-foreground">requests/hour</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Endpoints</CardTitle>
            <Code className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{API_ENDPOINTS.length}</div>
            <p className="text-xs text-muted-foreground">available</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="keys">
        <TabsList>
          <TabsTrigger value="keys">API Keys</TabsTrigger>
          <TabsTrigger value="docs">Documentation</TabsTrigger>
        </TabsList>

        <TabsContent value="keys" className="space-y-4">
          {apiKeys.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Key className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">No API keys yet</p>
                <p className="text-sm text-muted-foreground mb-4">Create your first API key to start integrating.</p>
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create API Key
                </Button>
              </CardContent>
            </Card>
          ) : (
            apiKeys.map((key) => (
              <Card key={key.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {key.name}
                        <Badge variant={key.is_active ? "default" : "secondary"}>
                          {key.is_active ? "Active" : "Disabled"}
                        </Badge>
                      </CardTitle>
                      <CardDescription>Created {new Date(key.created_at).toLocaleDateString()}</CardDescription>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => toggleKeyActive(key)}>
                        <Shield className={`h-4 w-4 ${key.is_active ? "text-green-500" : "text-muted-foreground"}`} />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteKey(key.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-muted px-3 py-2 rounded font-mono overflow-hidden">
                      {revealedKeys[key.id] ? key.api_key : key.api_key.slice(0, 12) + "••••••••••••••••"}
                    </code>
                    <Button variant="ghost" size="icon" onClick={() => toggleReveal(key.id)}>
                      {revealedKeys[key.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => copyToClipboard(key.api_key)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {key.scopes?.map((scope) => (
                      <Badge key={scope} variant="outline" className="text-xs">{scope}</Badge>
                    ))}
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Activity className="h-3 w-3" />
                      {key.rate_limit_per_hour} req/hr
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Last used: {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : "Never"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="docs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                API Reference
              </CardTitle>
              <CardDescription>Base URL: <code className="bg-muted px-2 py-0.5 rounded text-xs">{window.location.origin}/api/v1</code></CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-2">Authentication</h4>
                  <p className="text-sm text-muted-foreground mb-2">Include your API key in the request headers:</p>
                  <code className="block bg-background p-3 rounded text-xs font-mono">
                    {`Authorization: Bearer mk_live_xxxxx`}
                  </code>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">Available Endpoints</h4>
                  {API_ENDPOINTS.map((endpoint, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
                      <Badge variant={endpoint.method === "GET" ? "secondary" : "default"} className="font-mono text-xs w-12 justify-center">
                        {endpoint.method}
                      </Badge>
                      <code className="text-xs font-mono flex-1">{endpoint.path}</code>
                      <span className="text-xs text-muted-foreground">{endpoint.description}</span>
                      <Badge variant="outline" className="text-xs">{endpoint.scope}</Badge>
                    </div>
                  ))}
                </div>

                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-2">Rate Limiting</h4>
                  <p className="text-sm text-muted-foreground">
                    API requests are limited to <strong>1,000 requests per hour</strong> per API key. Exceeding this limit will return a <code className="bg-background px-1 rounded">429 Too Many Requests</code> response.
                  </p>
                </div>

                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-2">Example: List Products</h4>
                  <code className="block bg-background p-3 rounded text-xs font-mono whitespace-pre">{`curl -X GET "${window.location.origin}/api/v1/products" \\
  -H "Authorization: Bearer mk_live_xxxxx" \\
  -H "Content-Type: application/json"`}</code>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Key Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>Generate a new API key for your integrations</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Key Name</Label>
              <Input value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="e.g. Production, Staging" />
            </div>
            <div className="grid gap-2">
              <Label>Rate Limit (requests/hour)</Label>
              <Select value={rateLimit} onValueChange={setRateLimit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="100">100/hour</SelectItem>
                  <SelectItem value="500">500/hour</SelectItem>
                  <SelectItem value="1000">1,000/hour</SelectItem>
                  <SelectItem value="5000">5,000/hour</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Permissions (Scopes)</Label>
              <div className="grid grid-cols-2 gap-2">
                {AVAILABLE_SCOPES.map((scope) => (
                  <label key={scope.value} className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-muted/50">
                    <Checkbox
                      checked={selectedScopes.includes(scope.value)}
                      onCheckedChange={() => toggleScope(scope.value)}
                    />
                    <div>
                      <p className="text-xs font-medium">{scope.label}</p>
                      <p className="text-xs text-muted-foreground">{scope.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={generateKey}>Generate Key</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VendorApiAccess;
