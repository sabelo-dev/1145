import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { User, Store, Shield, Bell, Truck, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ConsumerProfile: React.FC = () => {
  const { user, isDriver, refreshUserProfile } = useAuth();
  const { toast } = useToast();
  const [showDriverDialog, setShowDriverDialog] = useState(false);
  const [driverForm, setDriverForm] = useState({
    name: user?.name || '',
    phone: '',
    vehicleType: 'car',
    licenseNumber: '',
    vehicleRegistration: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDriverRegistration = async () => {
    if (!user) return;
    
    if (!driverForm.name || !driverForm.phone || !driverForm.licenseNumber) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Create driver record
      const { error: driverError } = await supabase
        .from('drivers')
        .insert({
          user_id: user.id,
          name: driverForm.name,
          phone: driverForm.phone,
          vehicle_type: driverForm.vehicleType,
          license_number: driverForm.licenseNumber,
          vehicle_registration: driverForm.vehicleRegistration,
          status: 'pending',
        });

      if (driverError) throw driverError;

      // Add driver role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: user.id,
          role: 'driver',
        });

      if (roleError && !roleError.message.includes('duplicate')) {
        throw roleError;
      }

      toast({
        title: "Registration Submitted",
        description: "Your driver application has been submitted. You'll be notified once approved.",
      });

      setShowDriverDialog(false);
      await refreshUserProfile();
    } catch (error: any) {
      console.error('Driver registration error:', error);
      toast({
        title: "Registration Failed",
        description: error.message || "Failed to register as driver. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <User className="h-5 w-5" />
        <span className="text-lg font-medium">Profile Settings</span>
      </div>

      <div className="grid gap-6">
        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" defaultValue={user?.name?.split(' ')[0] || ""} />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" defaultValue={user?.name?.split(' ')[1] || ""} />
              </div>
            </div>
            
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" type="email" defaultValue={user?.email || ""} disabled />
              <p className="text-xs text-muted-foreground mt-1">
                Email cannot be changed. Contact support if you need to update it.
              </p>
            </div>
            
            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" type="tel" placeholder="+27 123 456 789" />
            </div>
            
            <div>
              <Label htmlFor="dateOfBirth">Date of Birth</Label>
              <Input id="dateOfBirth" type="date" />
            </div>
            
            <Button>Update Personal Information</Button>
          </CardContent>
        </Card>

        {/* Account Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Account Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input id="currentPassword" type="password" />
            </div>
            <div>
              <Label htmlFor="newPassword">New Password</Label>
              <Input id="newPassword" type="password" />
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input id="confirmPassword" type="password" />
            </div>
            
            <Button>Update Password</Button>
          </CardContent>
        </Card>

        {/* Notification Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notification Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Order Updates</h4>
                <p className="text-sm text-muted-foreground">
                  Get notified about order status changes
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Promotional Emails</h4>
                <p className="text-sm text-muted-foreground">
                  Receive promotional emails and special offers
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">SMS Notifications</h4>
                <p className="text-sm text-muted-foreground">
                  Receive SMS updates for important order events
                </p>
              </div>
              <Switch />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Wishlist Alerts</h4>
                <p className="text-sm text-muted-foreground">
                  Get notified when wishlist items go on sale
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            
            <Button>Save Preferences</Button>
          </CardContent>
        </Card>

        {/* Account Status */}
        <Card>
          <CardHeader>
            <CardTitle>Account Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Account Type</h4>
                <p className="text-sm text-muted-foreground">
                  Your current account role and permissions
                </p>
              </div>
              <Badge variant="secondary">Consumer</Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Member Since</h4>
                <p className="text-sm text-muted-foreground">
                  Your account creation date
                </p>
              </div>
              <span className="text-sm">January 2024</span>
            </div>
            
            {/* Become a Vendor */}
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <Store className="h-6 w-6 text-primary" />
                <div>
                  <h4 className="font-medium">Become a Vendor</h4>
                  <p className="text-sm text-muted-foreground">
                    Start selling your products on our platform
                  </p>
                </div>
              </div>
              <Link to="/vendor/register" className="mt-3 inline-block">
                <Button variant="outline">
                  Apply to Become a Vendor
                </Button>
              </Link>
            </div>

            {/* Become a Driver */}
            {!isDriver && (
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <Truck className="h-6 w-6 text-primary" />
                  <div>
                    <h4 className="font-medium">Become a Driver</h4>
                    <p className="text-sm text-muted-foreground">
                      Deliver orders and earn money on your schedule
                    </p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  className="mt-3"
                  onClick={() => setShowDriverDialog(true)}
                >
                  Apply to Become a Driver
                </Button>
              </div>
            )}

            {isDriver && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <Truck className="h-6 w-6 text-green-600" />
                  <div>
                    <h4 className="font-medium text-green-800">Driver Account Active</h4>
                    <p className="text-sm text-green-700">
                      You're registered as a driver. Access your dashboard to manage deliveries.
                    </p>
                  </div>
                </div>
                <Link to="/driver/dashboard" className="mt-3 inline-block">
                  <Button variant="outline" className="border-green-600 text-green-600 hover:bg-green-50">
                    Go to Driver Dashboard
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium">Delete Account</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
              <Button variant="destructive">Delete Account</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Driver Registration Dialog */}
      <Dialog open={showDriverDialog} onOpenChange={setShowDriverDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Register as a Driver</DialogTitle>
            <DialogDescription>
              Fill in your details to apply as a delivery driver. Your application will be reviewed by our team.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="driverName">Full Name *</Label>
              <Input
                id="driverName"
                value={driverForm.name}
                onChange={(e) => setDriverForm({ ...driverForm, name: e.target.value })}
                placeholder="Enter your full name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="driverPhone">Phone Number *</Label>
              <Input
                id="driverPhone"
                value={driverForm.phone}
                onChange={(e) => setDriverForm({ ...driverForm, phone: e.target.value })}
                placeholder="+27 123 456 789"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vehicleType">Vehicle Type</Label>
              <select
                id="vehicleType"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={driverForm.vehicleType}
                onChange={(e) => setDriverForm({ ...driverForm, vehicleType: e.target.value })}
              >
                <option value="car">Car</option>
                <option value="motorcycle">Motorcycle</option>
                <option value="bicycle">Bicycle</option>
                <option value="van">Van</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="licenseNumber">License Number *</Label>
              <Input
                id="licenseNumber"
                value={driverForm.licenseNumber}
                onChange={(e) => setDriverForm({ ...driverForm, licenseNumber: e.target.value })}
                placeholder="Enter your driver's license number"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vehicleRegistration">Vehicle Registration</Label>
              <Input
                id="vehicleRegistration"
                value={driverForm.vehicleRegistration}
                onChange={(e) => setDriverForm({ ...driverForm, vehicleRegistration: e.target.value })}
                placeholder="Enter vehicle registration number"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDriverDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleDriverRegistration} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ConsumerProfile;
