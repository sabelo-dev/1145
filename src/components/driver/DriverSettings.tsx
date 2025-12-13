import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Save, User, Car, Phone, Mail } from "lucide-react";

interface Driver {
  id: string;
  name: string;
  phone: string | null;
  vehicle_type: string | null;
  license_number: string | null;
  vehicle_registration: string | null;
  status: string;
}

interface DriverSettingsProps {
  driver: Driver | null;
  onUpdate: () => void;
}

const DriverSettings: React.FC<DriverSettingsProps> = ({ driver, onUpdate }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    vehicle_type: "",
    license_number: "",
    vehicle_registration: "",
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (driver) {
      setFormData({
        name: driver.name || "",
        phone: driver.phone || "",
        vehicle_type: driver.vehicle_type || "",
        license_number: driver.license_number || "",
        vehicle_registration: driver.vehicle_registration || "",
      });
    }
  }, [driver]);

  const handleSave = async () => {
    if (!driver) return;

    setSaving(true);

    const { error } = await supabase
      .from("drivers")
      .update({
        name: formData.name,
        phone: formData.phone,
        vehicle_type: formData.vehicle_type,
        license_number: formData.license_number,
        vehicle_registration: formData.vehicle_registration,
      })
      .eq("id", driver.id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "Could not save your settings. Please try again.",
      });
    } else {
      toast({
        title: "Settings Saved",
        description: "Your profile has been updated successfully.",
      });
      onUpdate();
    }

    setSaving(false);
  };

  if (!driver) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-xl font-semibold">Profile Settings</h2>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Account Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Email Address</Label>
            <Input value={user?.email || ""} disabled className="bg-muted" />
            <p className="text-xs text-muted-foreground">
              Email cannot be changed from here.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Personal Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Your full name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+27 XX XXX XXXX"
            />
          </div>
        </CardContent>
      </Card>

      {/* Vehicle Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            Vehicle Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vehicle_type">Vehicle Type</Label>
            <Select
              value={formData.vehicle_type}
              onValueChange={(value) => setFormData({ ...formData, vehicle_type: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select vehicle type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="motorcycle">Motorcycle</SelectItem>
                <SelectItem value="scooter">Scooter</SelectItem>
                <SelectItem value="bicycle">Bicycle</SelectItem>
                <SelectItem value="car">Car</SelectItem>
                <SelectItem value="van">Van</SelectItem>
                <SelectItem value="truck">Truck</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="license_number">Driver's License Number</Label>
            <Input
              id="license_number"
              value={formData.license_number}
              onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
              placeholder="Your license number"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vehicle_registration">Vehicle Registration</Label>
            <Input
              id="vehicle_registration"
              value={formData.vehicle_registration}
              onChange={(e) => setFormData({ ...formData, vehicle_registration: e.target.value })}
              placeholder="Vehicle registration number"
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </>
        )}
      </Button>
    </div>
  );
};

export default DriverSettings;