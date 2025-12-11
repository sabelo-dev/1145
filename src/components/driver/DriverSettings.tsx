import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Driver } from "@/types/driver";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User, Car, Phone, FileText } from "lucide-react";

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

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-semibold">Settings</h2>
        <p className="text-muted-foreground">Manage your driver profile</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Personal Information
            </CardTitle>
            <CardDescription>Your personal details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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

        {/* Stats Card (Read-only) */}
        <Card>
          <CardHeader>
            <CardTitle>Your Stats</CardTitle>
            <CardDescription>Your overall performance metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Total Deliveries</p>
                <p className="text-2xl font-bold">{driver.total_deliveries}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Rating</p>
                <p className="text-2xl font-bold">{Number(driver.rating).toFixed(1)} ⭐</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" disabled={saving} className="w-full sm:w-auto">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      </form>
    </div>
  );
};

export default DriverSettings;
