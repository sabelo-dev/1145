
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PaymentMethodDialog } from "./dialogs/PaymentMethodDialog";
import { 
  Store, 
  User, 
  Bell, 
  CreditCard,
  Shield,
  Save
} from "lucide-react";

const VendorSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [storeData, setStoreData] = useState({
    id: '',
    name: '',
    slug: '',
    description: '',
    logo_url: ''
  });
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    phone: ''
  });
  const [notifications, setNotifications] = useState({
    newOrders: true,
    lowStock: true,
    marketing: false
  });

  useEffect(() => {
    fetchSettingsData();
  }, [user?.id]);

  const fetchSettingsData = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      // Get vendor data
      const { data: vendor, error: vendorError } = await supabase
        .from('vendors')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (vendorError) throw vendorError;
      setVendorId(vendor.id);

      // Get store data
      const { data: store, error: storeError } = await supabase
        .from('stores')
        .select('*')
        .eq('vendor_id', vendor.id)
        .single();

      if (store && !storeError) {
        setStoreData({
          id: store.id,
          name: store.name || '',
          slug: store.slug || '',
          description: store.description || '',
          logo_url: store.logo_url || ''
        });
      }

      // Get profile data
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile && !profileError) {
        setProfileData({
          name: profile.name || '',
          email: profile.email || '',
          phone: profile.phone || ''
        });
      }

    } catch (error) {
      console.error('Error fetching settings:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load settings",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveStoreSettings = async () => {
    if (!user?.id || !storeData.id) return;

    try {
      // Generate slug from name if slug is empty
      let slug = storeData.slug.trim();
      if (!slug && storeData.name) {
        slug = storeData.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
      }

      // Update store data using the store ID
      const { error } = await supabase
        .from('stores')
        .update({
          name: storeData.name,
          slug: slug,
          description: storeData.description,
          logo_url: storeData.logo_url
        })
        .eq('id', storeData.id);

      if (error) {
        // Check if it's a duplicate slug error
        if (error.code === '23505' && error.message.includes('stores_slug_key')) {
          toast({
            variant: "destructive",
            title: "Duplicate Store URL",
            description: "This store URL is already taken. Please choose a different one.",
          });
          return;
        }
        throw error;
      }

      // Update local state with the generated slug
      setStoreData(prev => ({ ...prev, slug }));

      toast({
        title: "Settings Saved",
        description: "Store settings have been updated successfully.",
      });
    } catch (error) {
      console.error('Error saving store settings:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save store settings",
      });
    }
  };

  const saveProfileSettings = async () => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: profileData.name,
          email: profileData.email,
          phone: profileData.phone
        })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: "Profile Updated",
        description: "Profile settings have been updated successfully.",
      });
    } catch (error) {
      console.error('Error saving profile settings:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save profile settings",
      });
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading settings...</div>;
  }
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">
          Manage your store and account settings.
        </p>
      </div>

      {/* Store Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            Store Information
          </CardTitle>
          <CardDescription>
            Update your store details and branding.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="store-name">Store Name</Label>
              <Input 
                id="store-name" 
                value={storeData.name}
                onChange={(e) => setStoreData({...storeData, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="store-slug">Store URL</Label>
              <Input 
                id="store-slug" 
                value={storeData.slug}
                onChange={(e) => setStoreData({...storeData, slug: e.target.value})}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="store-description">Description</Label>
            <Textarea 
              id="store-description" 
              value={storeData.description}
              onChange={(e) => setStoreData({...storeData, description: e.target.value})}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="store-logo">Store Logo URL</Label>
            <Input 
              id="store-logo" 
              value={storeData.logo_url}
              onChange={(e) => setStoreData({...storeData, logo_url: e.target.value})}
              placeholder="https://example.com/logo.png" 
            />
          </div>
          <Button onClick={saveStoreSettings}>
            <Save className="h-4 w-4 mr-2" />
            Save Store Settings
          </Button>
        </CardContent>
      </Card>

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Settings
          </CardTitle>
          <CardDescription>
            Update your personal information.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="full-name">Full Name</Label>
              <Input 
                id="full-name" 
                value={profileData.name}
                onChange={(e) => setProfileData({...profileData, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                value={profileData.email}
                onChange={(e) => setProfileData({...profileData, email: e.target.value})}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input 
              id="phone" 
              value={profileData.phone}
              onChange={(e) => setProfileData({...profileData, phone: e.target.value})}
            />
          </div>
          <Button onClick={saveProfileSettings}>
            <Save className="h-4 w-4 mr-2" />
            Save Profile
          </Button>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Preferences
          </CardTitle>
          <CardDescription>
            Choose how you want to be notified about your store activity.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>New Orders</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when you receive new orders
              </p>
            </div>
            <Switch 
              checked={notifications.newOrders}
              onCheckedChange={(checked) => setNotifications({...notifications, newOrders: checked})}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Low Stock Alerts</Label>
              <p className="text-sm text-muted-foreground">
                Get alerts when product inventory is low
              </p>
            </div>
            <Switch 
              checked={notifications.lowStock}
              onCheckedChange={(checked) => setNotifications({...notifications, lowStock: checked})}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Marketing Updates</Label>
              <p className="text-sm text-muted-foreground">
                Receive updates about new features and promotions
              </p>
            </div>
            <Switch 
              checked={notifications.marketing}
              onCheckedChange={(checked) => setNotifications({...notifications, marketing: checked})}
            />
          </div>
        </CardContent>
      </Card>

      {/* Payment Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Settings
          </CardTitle>
          <CardDescription>
            Manage your payout and payment information.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bank-account">Account Number</Label>
              <Input id="bank-account" placeholder="****1234" disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bank-name">Bank Name</Label>
              <Input id="bank-name" placeholder="Standard Bank" disabled />
            </div>
          </div>
          <Button variant="outline" onClick={() => setPaymentDialogOpen(true)}>
            <CreditCard className="h-4 w-4 mr-2" />
            Update Payment Method
          </Button>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security
          </CardTitle>
          <CardDescription>
            Manage your account security settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline">
            Change Password
          </Button>
          <Button variant="outline">
            Enable Two-Factor Authentication
          </Button>
        </CardContent>
      </Card>

      {vendorId && (
        <PaymentMethodDialog
          open={paymentDialogOpen}
          onOpenChange={setPaymentDialogOpen}
          vendorId={vendorId}
        />
      )}
    </div>
  );
};

export default VendorSettings;
