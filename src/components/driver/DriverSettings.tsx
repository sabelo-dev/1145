import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Driver } from "@/types/driver";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User, Car, FileText, Mail, Star, Package, Shield } from "lucide-react";

interface DriverSettingsProps {
  driver: Driver;
  onUpdate: () => void;
}

const vehicleTypes = [
  { value: "motorcycle", label: "Motorcycle" },
  { value: "car", label: "Car" },
  { value: "van", label: "Van" },
  { value: "truck", label: "Truck" },
];

const DriverSettings: React.FC<DriverSettingsProps> = ({ driver, onUpdate }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: driver.name || "",
    phone: driver.phone || "",
    vehicle_type: driver.vehicle_type || "",
    vehicle_registration: driver.vehicle_registration || "",
    license_number: driver.license_number || "",
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { error } = await supabase
        .from("drivers")
        .update(formData)
        .eq("id", driver.id);

      if (error) throw error;

      toast({
        title: "Settings Saved",
        description: "Your profile has been updated successfully",
      });

      onUpdate();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save settings",
      });
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl font-semibold">Profile & Settings</h2>
        <p className="text-muted-foreground">Manage your driver profile and account settings</p>
      </div>

      {/* Profile Overview Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <Avatar className="h-24 w-24 border-4 border-primary/10">
              <AvatarImage src={user?.avatar_url || ""} alt={driver.name} />
              <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                {getInitials(driver.name || "Driver")}
              </AvatarFallback>
            </Avatar>
            <div className="text-center sm:text-left flex-1">
              <h3 className="text-2xl font-bold">{driver.name}</h3>
              <div className="flex items-center gap-2 justify-center sm:justify-start text-muted-foreground mt-1">
                <Mail className="h-4 w-4" />
                <span>{user?.email}</span>
              </div>
              <div className="flex flex-wrap gap-3 mt-4 justify-center sm:justify-start">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm">
                  <Shield className="h-4 w-4" />
                  <span>Verified Driver</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-500/10 text-yellow-600 text-sm">
                  <Star className="h-4 w-4" />
                  <span>{Number(driver.rating).toFixed(1)} Rating</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 text-green-600 text-sm">
                  <Package className="h-4 w-4" />
                  <span>{driver.total_deliveries} Deliveries</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Personal Information
            </CardTitle>
            <CardDescription>Update your personal details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="Enter your full name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={user?.email || ""}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">Email cannot be changed</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                placeholder="Enter your phone number"
              />
            </div>
          </CardContent>
        </Card>

        {/* Vehicle Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="h-5 w-5" />
              Vehicle Information
            </CardTitle>
            <CardDescription>Details about your delivery vehicle</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="vehicle_type">Vehicle Type</Label>
                <Select
                  value={formData.vehicle_type}
                  onValueChange={(value) => handleChange("vehicle_type", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select vehicle type" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicleTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="vehicle_registration">Registration Number</Label>
                <Input
                  id="vehicle_registration"
                  value={formData.vehicle_registration}
                  onChange={(e) => handleChange("vehicle_registration", e.target.value)}
                  placeholder="e.g., ABC 123 GP"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* License Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              License Information
            </CardTitle>
            <CardDescription>Your driving license details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="license_number">License Number</Label>
              <Input
                id="license_number"
                value={formData.license_number}
                onChange={(e) => handleChange("license_number", e.target.value)}
                placeholder="Enter your license number"
              />
            </div>
          </CardContent>
        </Card>

        {/* Performance Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Statistics</CardTitle>
            <CardDescription>Your overall performance as a driver</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <Package className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                <p className="text-2xl font-bold">{driver.total_deliveries}</p>
                <p className="text-xs text-muted-foreground">Total Deliveries</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <Star className="h-5 w-5 mx-auto mb-2 text-yellow-500" />
                <p className="text-2xl font-bold">{Number(driver.rating).toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Average Rating</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <Car className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                <p className="text-2xl font-bold capitalize">{driver.vehicle_type || "N/A"}</p>
                <p className="text-xs text-muted-foreground">Vehicle Type</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <Shield className="h-5 w-5 mx-auto mb-2 text-green-500" />
                <p className="text-2xl font-bold capitalize">{driver.status}</p>
                <p className="text-xs text-muted-foreground">Current Status</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving} size="lg">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving Changes...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default DriverSettings;
