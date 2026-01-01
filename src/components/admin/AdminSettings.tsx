
import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
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
      const { data, error } = await supabase
        .from('platform_settings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;

      if (data) {
        setSettingsId(data.id);
        form.reset({
          platformName: data.platform_name,
          platformEmail: data.platform_email,
          platformFee: String(data.platform_fee),
          vendorFee: String(data.vendor_fee),
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
      const settingsData = {
        platform_name: data.platformName,
        platform_email: data.platformEmail,
        platform_fee: parseFloat(data.platformFee),
        vendor_fee: parseFloat(data.vendorFee),
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
    </div>
  );
};

export default AdminSettings;
