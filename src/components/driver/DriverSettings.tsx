import React, { useState, useEffect, useRef } from "react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Save, User, Car, Phone, Mail, Upload, Camera, Palette } from "lucide-react";

interface Driver {
  id: string;
  name: string;
  phone: string | null;
  vehicle_type: string | null;
  license_number: string | null;
  vehicle_registration: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: number | null;
  vehicle_color: string | null;
  vehicle_photo_url: string | null;
  status: string;
}

interface DriverSettingsProps {
  driver: Driver | null;
  onUpdate: () => void;
}

const VEHICLE_COLORS = [
  { name: "White", hex: "#FFFFFF" },
  { name: "Black", hex: "#000000" },
  { name: "Silver", hex: "#C0C0C0" },
  { name: "Gray", hex: "#808080" },
  { name: "Red", hex: "#DC2626" },
  { name: "Blue", hex: "#2563EB" },
  { name: "Green", hex: "#16A34A" },
  { name: "Yellow", hex: "#EAB308" },
  { name: "Orange", hex: "#EA580C" },
  { name: "Brown", hex: "#78350F" },
  { name: "Beige", hex: "#D4C4A8" },
  { name: "Gold", hex: "#CA8A04" },
  { name: "Maroon", hex: "#7F1D1D" },
  { name: "Navy", hex: "#1E3A5F" },
];

const VEHICLE_MAKES = [
  "Toyota", "Volkswagen", "Ford", "Nissan", "Honda", "Hyundai", "Kia", "BMW",
  "Mercedes-Benz", "Audi", "Mazda", "Suzuki", "Isuzu", "Chevrolet", "Renault",
  "Peugeot", "Opel", "Jeep", "Mitsubishi", "Subaru", "Volvo", "Land Rover",
  "Fiat", "Haval", "GWM", "Chery", "JAC", "BAIC", "Other"
];

const currentYear = new Date().getFullYear();
const VEHICLE_YEARS = Array.from({ length: 30 }, (_, i) => currentYear - i);

const DriverSettings: React.FC<DriverSettingsProps> = ({ driver, onUpdate }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const vehiclePhotoRef = useRef<HTMLInputElement>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    vehicle_type: "",
    license_number: "",
    vehicle_registration: "",
    vehicle_make: "",
    vehicle_model: "",
    vehicle_year: "",
    vehicle_color: "",
    vehicle_photo_url: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (driver) {
      setFormData({
        name: driver.name || "",
        phone: driver.phone || "",
        vehicle_type: driver.vehicle_type || "",
        license_number: driver.license_number || "",
        vehicle_registration: driver.vehicle_registration || "",
        vehicle_make: driver.vehicle_make || "",
        vehicle_model: driver.vehicle_model || "",
        vehicle_year: driver.vehicle_year?.toString() || "",
        vehicle_color: driver.vehicle_color || "",
        vehicle_photo_url: driver.vehicle_photo_url || "",
      });
    }
  }, [driver]);

  const handleVehiclePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !driver) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file (JPG, PNG, etc.)",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${driver.id}/vehicle.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('driver-vehicles')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('driver-vehicles')
        .getPublicUrl(fileName);

      const urlWithCacheBust = `${publicUrl}?t=${Date.now()}`;
      setFormData({ ...formData, vehicle_photo_url: urlWithCacheBust });

      toast({
        title: "Photo uploaded",
        description: "Vehicle photo has been uploaded. Remember to save your changes.",
      });
    } catch (error: any) {
      console.error('Vehicle photo upload error:', error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload photo. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

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
        vehicle_make: formData.vehicle_make || null,
        vehicle_model: formData.vehicle_model || null,
        vehicle_year: formData.vehicle_year ? parseInt(formData.vehicle_year) : null,
        vehicle_color: formData.vehicle_color || null,
        vehicle_photo_url: formData.vehicle_photo_url || null,
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

  const selectedColor = VEHICLE_COLORS.find(c => c.name === formData.vehicle_color);

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
          <p className="text-sm text-muted-foreground">
            These details help customers identify your vehicle during delivery
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Vehicle Photo */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Vehicle Photo
            </Label>
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <div className="relative">
                <Avatar className="h-32 w-32 rounded-lg border-2 border-border">
                  <AvatarImage 
                    src={formData.vehicle_photo_url} 
                    alt="Vehicle" 
                    className="object-cover"
                  />
                  <AvatarFallback className="rounded-lg bg-muted">
                    <Car className="h-12 w-12 text-muted-foreground" />
                  </AvatarFallback>
                </Avatar>
                {isUploadingPhoto && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <p className="text-sm text-muted-foreground">
                  Upload a clear photo of your vehicle. This helps customers identify you on arrival.
                </p>
                <input
                  ref={vehiclePhotoRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleVehiclePhotoUpload}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => vehiclePhotoRef.current?.click()}
                  disabled={isUploadingPhoto}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Photo
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Vehicle Type */}
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

            {/* Vehicle Make */}
            <div className="space-y-2">
              <Label htmlFor="vehicle_make">Vehicle Make</Label>
              <Select
                value={formData.vehicle_make}
                onValueChange={(value) => setFormData({ ...formData, vehicle_make: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select make" />
                </SelectTrigger>
                <SelectContent>
                  {VEHICLE_MAKES.map((make) => (
                    <SelectItem key={make} value={make}>
                      {make}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Vehicle Model */}
            <div className="space-y-2">
              <Label htmlFor="vehicle_model">Vehicle Model</Label>
              <Input
                id="vehicle_model"
                value={formData.vehicle_model}
                onChange={(e) => setFormData({ ...formData, vehicle_model: e.target.value })}
                placeholder="e.g., Corolla, Polo, Ranger"
              />
            </div>

            {/* Vehicle Year */}
            <div className="space-y-2">
              <Label htmlFor="vehicle_year">Vehicle Year</Label>
              <Select
                value={formData.vehicle_year}
                onValueChange={(value) => setFormData({ ...formData, vehicle_year: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {VEHICLE_YEARS.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Vehicle Color */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Vehicle Color
            </Label>
            <div className="flex flex-wrap gap-2">
              {VEHICLE_COLORS.map((color) => (
                <button
                  key={color.name}
                  type="button"
                  onClick={() => setFormData({ ...formData, vehicle_color: color.name })}
                  className={`w-10 h-10 rounded-full border-2 transition-all ${
                    formData.vehicle_color === color.name
                      ? "ring-2 ring-primary ring-offset-2"
                      : "hover:scale-110"
                  }`}
                  style={{ 
                    backgroundColor: color.hex,
                    borderColor: color.name === "White" ? "#e5e7eb" : color.hex
                  }}
                  title={color.name}
                />
              ))}
            </div>
            {selectedColor && (
              <p className="text-sm text-muted-foreground">
                Selected: <span className="font-medium">{selectedColor.name}</span>
              </p>
            )}
          </div>

          {/* Registration Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
            <div className="space-y-2">
              <Label htmlFor="vehicle_registration">Registration Number</Label>
              <Input
                id="vehicle_registration"
                value={formData.vehicle_registration}
                onChange={(e) => setFormData({ ...formData, vehicle_registration: e.target.value.toUpperCase() })}
                placeholder="e.g., CA 123-456"
                className="uppercase"
              />
              <p className="text-xs text-muted-foreground">
                Displayed to customers for vehicle identification
              </p>
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
          </div>

          {/* Vehicle Preview Card */}
          {(formData.vehicle_make || formData.vehicle_color || formData.vehicle_registration) && (
            <div className="p-4 bg-muted rounded-lg border">
              <h4 className="text-sm font-medium mb-3">Customer View Preview</h4>
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 rounded-lg">
                  <AvatarImage 
                    src={formData.vehicle_photo_url} 
                    alt="Vehicle" 
                    className="object-cover"
                  />
                  <AvatarFallback className="rounded-lg bg-background">
                    <Car className="h-6 w-6 text-muted-foreground" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium">
                    {formData.vehicle_color && (
                      <span 
                        className="inline-block w-3 h-3 rounded-full mr-2 border"
                        style={{ 
                          backgroundColor: selectedColor?.hex,
                          borderColor: formData.vehicle_color === "White" ? "#e5e7eb" : selectedColor?.hex
                        }}
                      />
                    )}
                    {[formData.vehicle_make, formData.vehicle_model, formData.vehicle_year]
                      .filter(Boolean)
                      .join(" ") || "Vehicle details"}
                  </p>
                  {formData.vehicle_registration && (
                    <p className="text-sm text-muted-foreground font-mono">
                      {formData.vehicle_registration}
                    </p>
                  )}
                  {formData.vehicle_type && (
                    <p className="text-xs text-muted-foreground capitalize">
                      {formData.vehicle_type}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
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