
import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface SettingsForm {
  platformName: string;
  platformEmail: string;
  platformFee: string;
  vendorFee: string;
  supportEmail: string;
  termsOfService: string;
  privacyPolicy: string;
}

const AdminSettings: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);

  const [resetting, setResetting] = useState(false);
  const [resetScopes, setResetScopes] = useState({
    orders: true,
    products: true,
    auctions: true,
  });
  const [resetConfirmText, setResetConfirmText] = useState("");

  const form = useForm<SettingsForm>({
    defaultValues: {
      platformName: "1145 Lifestyle",
      platformEmail: "support@1145lifestyle.com",
      platformFee: "5",
      vendorFee: "10",
      supportEmail: "help@1145lifestyle.com",
      termsOfService: "Standard terms of service for WWE marketplace...",
      privacyPolicy: "Privacy policy for WWE marketplace..."
    },
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // Use maybeSingle() so a fresh project (no settings row yet) doesn't throw.
      const { data, error } = await supabase
        .from('platform_settings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettingsId(data.id);
        form.reset({
          platformName: data.platform_name,
          platformEmail: data.platform_email,
          platformFee: String(data.platform_fee ?? ""),
          vendorFee: String(data.vendor_fee ?? ""),
          supportEmail: data.support_email,
          termsOfService: data.terms_of_service || "",
          privacyPolicy: data.privacy_policy || ""
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast({
        title: "Error",
        description: "Failed to load platform settings",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: SettingsForm) => {
    setSaving(true);
    try {
      const platformFee = Number(data.platformFee);
      const vendorFee = Number(data.vendorFee);

      if (!Number.isFinite(platformFee) || platformFee < 0 || platformFee > 100) {
        throw new Error("Platform fee must be a number between 0 and 100");
      }

      if (!Number.isFinite(vendorFee) || vendorFee < 0 || vendorFee > 100) {
        throw new Error("Vendor fee must be a number between 0 and 100");
      }

      const settingsData = {
        platform_name: data.platformName,
        platform_email: data.platformEmail,
        platform_fee: platformFee,
        vendor_fee: vendorFee,
        support_email: data.supportEmail,
        terms_of_service: data.termsOfService,
        privacy_policy: data.privacyPolicy,
      };

      if (settingsId) {
        const { error } = await supabase
          .from('platform_settings')
          .update(settingsData)
          .eq('id', settingsId);

        if (error) throw error;
      } else {
        const { data: newSettings, error } = await supabase
          .from('platform_settings')
          .insert([settingsData])
          .select()
          .single();

        if (error) throw error;
        if (newSettings) setSettingsId(newSettings.id);
      }

      toast({
        title: "Settings updated",
        description: "Platform settings have been saved successfully.",
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Error",
        description: "Failed to save platform settings",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold">Platform Settings</h2>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Configure basic platform details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="platformName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Platform Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="platformEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Platform Email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Fee Configuration</CardTitle>
              <CardDescription>Set platform and vendor fees</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="platformFee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Platform Fee (%)</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" min="0" max="100" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="vendorFee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vendor Fee (%)</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" min="0" max="100" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Support & Legal</CardTitle>
              <CardDescription>Configure support and legal documents</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="supportEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Support Email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="termsOfService"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Terms of Service</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={5} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="privacyPolicy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Privacy Policy</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={5} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
          
          <Button type="submit" className="w-full md:w-auto" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Settings
          </Button>
        </form>
      </Form>

      <Card>
        <CardHeader>
          <CardTitle>Danger Zone</CardTitle>
          <CardDescription>
            Reset demo data without affecting authentication (does not touch auth users).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Choose what to clear, then type <span className="font-mono">RESET</span> to confirm.
            </p>

            <div className="grid gap-3 md:grid-cols-3">
              <label className="flex items-start gap-3 rounded-md border p-3">
                <Checkbox
                  checked={resetScopes.orders}
                  onCheckedChange={(v) =>
                    setResetScopes((s) => ({ ...s, orders: Boolean(v) }))
                  }
                />
                <span className="space-y-1">
                  <span className="block text-sm font-medium">Orders</span>
                  <span className="block text-xs text-muted-foreground">
                    orders, items, delivery jobs/history
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-3 rounded-md border p-3">
                <Checkbox
                  checked={resetScopes.products}
                  onCheckedChange={(v) =>
                    setResetScopes((s) => ({ ...s, products: Boolean(v) }))
                  }
                />
                <span className="space-y-1">
                  <span className="block text-sm font-medium">Products</span>
                  <span className="block text-xs text-muted-foreground">
                    products, images, variations, stores
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-3 rounded-md border p-3">
                <Checkbox
                  checked={resetScopes.auctions}
                  onCheckedChange={(v) =>
                    setResetScopes((s) => ({ ...s, auctions: Boolean(v) }))
                  }
                />
                <span className="space-y-1">
                  <span className="block text-sm font-medium">Auctions</span>
                  <span className="block text-xs text-muted-foreground">
                    auctions, bids, registrations, watchlists
                  </span>
                </span>
              </label>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <div className="flex-1 space-y-2">
                <FormLabel>Type RESET to confirm</FormLabel>
                <Input
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  placeholder="RESET"
                  className="font-mono"
                />
              </div>

              <Button
                type="button"
                variant="destructive"
                disabled={resetting}
                onClick={async () => {
                  const scopes = (Object.entries(resetScopes)
                    .filter(([, enabled]) => enabled)
                    .map(([key]) => key)) as Array<"orders" | "products" | "auctions">;

                  if (scopes.length === 0) {
                    toast({
                      title: "Nothing selected",
                      description: "Select at least one scope to reset.",
                      variant: "destructive",
                    });
                    return;
                  }

                  if (resetConfirmText.trim().toUpperCase() !== "RESET") {
                    toast({
                      title: "Confirmation required",
                      description: "Type RESET to run the demo data reset.",
                      variant: "destructive",
                    });
                    return;
                  }

                  setResetting(true);
                  try {
                    const { data, error } = await supabase.rpc("reset_demo_data", {
                      p_scopes: scopes,
                    });

                    if (error) throw error;

                    toast({
                      title: "Demo data reset complete",
                      description: `Cleared: ${scopes.join(", ")}.`,
                    });
                    setResetConfirmText("");
                    console.log("reset_demo_data result:", data);
                  } catch (err: any) {
                    console.error("reset_demo_data error:", err);
                    toast({
                      title: "Reset failed",
                      description:
                        err?.message || "Unable to reset demo data. Please try again.",
                      variant: "destructive",
                    });
                  } finally {
                    setResetting(false);
                  }
                }}
              >
                {resetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Reset Demo Data
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSettings;
