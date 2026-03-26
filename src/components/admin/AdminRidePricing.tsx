import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Car, Crown, Users, DollarSign, Settings, Save, Plus, Trash2,
  TrendingUp, Clock, Route, Zap, Moon, Calendar, AlertTriangle,
  Calculator, Pencil, X, Check,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface VehicleType {
  id: string;
  name: string;
  display_name: string;
  base_fare: number;
  per_km_rate: number;
  per_minute_rate: number;
  minimum_fare: number;
  max_passengers: number;
  icon: string;
  is_active: boolean;
  description: string | null;
}

const iconOptions = [
  { value: "car", label: "Standard", icon: Car },
  { value: "crown", label: "Premium", icon: Crown },
  { value: "users", label: "Shared", icon: Users },
];

const AdminRidePricing: React.FC = () => {
  const { toast } = useToast();
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<VehicleType>>({});
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newVehicle, setNewVehicle] = useState<Partial<VehicleType>>({
    name: "", display_name: "", base_fare: 25, per_km_rate: 8, per_minute_rate: 2,
    minimum_fare: 35, max_passengers: 4, icon: "car", is_active: true, description: "",
  });

  // Surge pricing config (local state - could be extended to DB)
  const [surgeConfig, setSurgeConfig] = useState({
    enabled: true,
    maxMultiplier: 3.0,
    nightMultiplier: 1.25,
    weekendMultiplier: 1.15,
    rushHourMultiplier: 1.4,
    nightStart: 20,
    nightEnd: 6,
    platformCommission: 15,
  });

  useEffect(() => { fetchVehicleTypes(); }, []);

  const fetchVehicleTypes = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("vehicle_types").select("*").order("base_fare", { ascending: true });
    if (error) { toast({ variant: "destructive", title: "Error loading vehicle types", description: error.message }); }
    else setVehicleTypes(data || []);
    setLoading(false);
  };

  const handleSaveVehicle = async (vehicle: VehicleType) => {
    setSaving(vehicle.id);
    const updates = editingId === vehicle.id ? editForm : vehicle;
    const { error } = await supabase.from("vehicle_types").update({
      name: updates.name ?? vehicle.name,
      display_name: updates.display_name ?? vehicle.display_name,
      base_fare: updates.base_fare ?? vehicle.base_fare,
      per_km_rate: updates.per_km_rate ?? vehicle.per_km_rate,
      per_minute_rate: updates.per_minute_rate ?? vehicle.per_minute_rate,
      minimum_fare: updates.minimum_fare ?? vehicle.minimum_fare,
      max_passengers: updates.max_passengers ?? vehicle.max_passengers,
      icon: updates.icon ?? vehicle.icon,
      is_active: updates.is_active ?? vehicle.is_active,
      description: updates.description ?? vehicle.description,
    }).eq("id", vehicle.id);

    if (error) toast({ variant: "destructive", title: "Error saving", description: error.message });
    else { toast({ title: "Vehicle type updated" }); setEditingId(null); fetchVehicleTypes(); }
    setSaving(null);
  };

  const handleAddVehicle = async () => {
    if (!newVehicle.name || !newVehicle.display_name) {
      toast({ variant: "destructive", title: "Name and display name are required" });
      return;
    }
    const { error } = await supabase.from("vehicle_types").insert({
      name: newVehicle.name!, display_name: newVehicle.display_name!,
      base_fare: newVehicle.base_fare!, per_km_rate: newVehicle.per_km_rate!,
      per_minute_rate: newVehicle.per_minute_rate!, minimum_fare: newVehicle.minimum_fare!,
      max_passengers: newVehicle.max_passengers!, icon: newVehicle.icon!,
      is_active: newVehicle.is_active!, description: newVehicle.description || null,
    });
    if (error) toast({ variant: "destructive", title: "Error adding vehicle type", description: error.message });
    else {
      toast({ title: "Vehicle type added" });
      setShowAddDialog(false);
      setNewVehicle({ name: "", display_name: "", base_fare: 25, per_km_rate: 8, per_minute_rate: 2, minimum_fare: 35, max_passengers: 4, icon: "car", is_active: true, description: "" });
      fetchVehicleTypes();
    }
  };

  const handleDeleteVehicle = async (id: string) => {
    const { error } = await supabase.from("vehicle_types").delete().eq("id", id);
    if (error) toast({ variant: "destructive", title: "Error deleting", description: error.message });
    else { toast({ title: "Vehicle type deleted" }); fetchVehicleTypes(); }
  };

  const handleToggleActive = async (vehicle: VehicleType) => {
    const { error } = await supabase.from("vehicle_types").update({ is_active: !vehicle.is_active }).eq("id", vehicle.id);
    if (error) toast({ variant: "destructive", title: "Error", description: error.message });
    else fetchVehicleTypes();
  };

  const startEditing = (vehicle: VehicleType) => {
    setEditingId(vehicle.id);
    setEditForm({ ...vehicle });
  };

  const simulateFare = (baseFare: number, perKm: number, perMin: number, minFare: number, km = 10, mins = 20) => {
    const fare = baseFare + km * perKm + mins * perMin;
    return Math.max(fare, minFare);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Calculator className="h-6 w-6 text-primary" />
            Ride Pricing Engine
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Configure vehicle types, base fares, per-km/min rates, surge pricing, and time-based multipliers</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Add Vehicle Type
        </Button>
      </div>

      {/* Surge & Time-Based Pricing Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-5 w-5 text-amber-500" /> Surge Pricing
            </CardTitle>
            <CardDescription>Dynamic pricing based on demand</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Enable Surge Pricing</Label>
              <Switch checked={surgeConfig.enabled} onCheckedChange={(v) => setSurgeConfig(c => ({ ...c, enabled: v }))} />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Max Surge Multiplier</span>
                <span className="font-bold text-foreground">{surgeConfig.maxMultiplier}x</span>
              </div>
              <Slider value={[surgeConfig.maxMultiplier]} min={1} max={5} step={0.1}
                onValueChange={([v]) => setSurgeConfig(c => ({ ...c, maxMultiplier: v }))} />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Rush Hour Multiplier</span>
                <span className="font-bold text-foreground">{surgeConfig.rushHourMultiplier}x</span>
              </div>
              <Slider value={[surgeConfig.rushHourMultiplier]} min={1} max={3} step={0.05}
                onValueChange={([v]) => setSurgeConfig(c => ({ ...c, rushHourMultiplier: v }))} />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Platform Commission</span>
                <span className="font-bold text-foreground">{surgeConfig.platformCommission}%</span>
              </div>
              <Slider value={[surgeConfig.platformCommission]} min={5} max={30} step={1}
                onValueChange={([v]) => setSurgeConfig(c => ({ ...c, platformCommission: v }))} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-5 w-5 text-indigo-500" /> Time-Based Multipliers
            </CardTitle>
            <CardDescription>Adjust pricing for nights, weekends, and rush hours</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Moon className="h-4 w-4 text-indigo-400" />
                <span className="text-muted-foreground">Night Multiplier ({surgeConfig.nightStart}:00 – {surgeConfig.nightEnd}:00)</span>
                <span className="ml-auto font-bold text-foreground">{surgeConfig.nightMultiplier}x</span>
              </div>
              <Slider value={[surgeConfig.nightMultiplier]} min={1} max={2} step={0.05}
                onValueChange={([v]) => setSurgeConfig(c => ({ ...c, nightMultiplier: v }))} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-purple-400" />
                <span className="text-muted-foreground">Weekend Multiplier</span>
                <span className="ml-auto font-bold text-foreground">{surgeConfig.weekendMultiplier}x</span>
              </div>
              <Slider value={[surgeConfig.weekendMultiplier]} min={1} max={2} step={0.05}
                onValueChange={([v]) => setSurgeConfig(c => ({ ...c, weekendMultiplier: v }))} />
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Night Start Hour</Label>
                <Input type="number" min={18} max={23} value={surgeConfig.nightStart}
                  onChange={(e) => setSurgeConfig(c => ({ ...c, nightStart: parseInt(e.target.value) || 20 }))} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Night End Hour</Label>
                <Input type="number" min={4} max={8} value={surgeConfig.nightEnd}
                  onChange={(e) => setSurgeConfig(c => ({ ...c, nightEnd: parseInt(e.target.value) || 6 }))} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fare Simulator */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-5 w-5 text-emerald-500" /> Fare Simulator
          </CardTitle>
          <CardDescription>Preview estimated fares for a 10 km, 20-minute trip</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {vehicleTypes.filter(v => v.is_active).map((type) => {
              const Icon = iconOptions.find(i => i.value === type.icon)?.icon || Car;
              const baseFare = simulateFare(type.base_fare, type.per_km_rate, type.per_minute_rate, type.minimum_fare);
              const nightFare = baseFare * surgeConfig.nightMultiplier;
              const surgeFare = baseFare * surgeConfig.maxMultiplier;

              return (
                <div key={type.id} className="p-4 rounded-xl border border-border bg-card space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-primary/10"><Icon className="h-5 w-5 text-primary" /></div>
                    <span className="font-bold text-sm text-foreground">{type.display_name}</span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">Normal</span><span className="font-bold text-foreground">R{baseFare.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><Moon className="h-3 w-3" />Night</span><span className="font-bold text-amber-600">R{nightFare.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><Zap className="h-3 w-3" />Peak Surge</span><span className="font-bold text-destructive">R{surgeFare.toFixed(2)}</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Vehicle Types CRUD */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Settings className="h-5 w-5 text-muted-foreground" /> Vehicle Types
        </h3>

        {vehicleTypes.map((vehicle) => {
          const isEditing = editingId === vehicle.id;
          const form = isEditing ? editForm : vehicle;
          const Icon = iconOptions.find(i => i.value === (form.icon || vehicle.icon))?.icon || Car;

          return (
            <Card key={vehicle.id} className={`transition-all ${!vehicle.is_active ? "opacity-60" : ""}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-xl ${vehicle.is_active ? "bg-primary/10" : "bg-muted"}`}>
                      <Icon className={`h-6 w-6 ${vehicle.is_active ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div>
                      {isEditing ? (
                        <div className="flex gap-2">
                          <Input value={form.display_name || ""} onChange={(e) => setEditForm(f => ({ ...f, display_name: e.target.value }))} className="h-8 text-sm font-bold w-40" />
                          <Input value={form.name || ""} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))} className="h-8 text-xs w-32" placeholder="slug" />
                        </div>
                      ) : (
                        <>
                          <h4 className="font-bold text-foreground">{vehicle.display_name}</h4>
                          <p className="text-xs text-muted-foreground">{vehicle.name} · {vehicle.max_passengers} passengers</p>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant={vehicle.is_active ? "default" : "secondary"}>{vehicle.is_active ? "Active" : "Inactive"}</Badge>
                    <Switch checked={vehicle.is_active} onCheckedChange={() => handleToggleActive(vehicle)} />
                    {isEditing ? (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
                        <Button size="sm" onClick={() => handleSaveVehicle(vehicle)} disabled={saving === vehicle.id}>
                          <Check className="h-4 w-4 mr-1" />{saving === vehicle.id ? "Saving..." : "Save"}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" onClick={() => startEditing(vehicle)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDeleteVehicle(vehicle.id)}><Trash2 className="h-4 w-4" /></Button>
                      </>
                    )}
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Base Fare", key: "base_fare" as const, icon: DollarSign, prefix: "R" },
                    { label: "Per KM Rate", key: "per_km_rate" as const, icon: Route, prefix: "R" },
                    { label: "Per Minute Rate", key: "per_minute_rate" as const, icon: Clock, prefix: "R" },
                    { label: "Minimum Fare", key: "minimum_fare" as const, icon: AlertTriangle, prefix: "R" },
                  ].map(({ label, key, icon: FIcon, prefix }) => (
                    <div key={key} className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <FIcon className="h-3 w-3" />{label}
                      </Label>
                      {isEditing ? (
                        <Input type="number" step="0.5" value={form[key] ?? vehicle[key]}
                          onChange={(e) => setEditForm(f => ({ ...f, [key]: parseFloat(e.target.value) || 0 }))}
                          className="h-9" />
                      ) : (
                        <p className="text-sm font-bold text-foreground">{prefix}{vehicle[key].toFixed(2)}</p>
                      )}
                    </div>
                  ))}
                </div>

                {isEditing && (
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Max Passengers</Label>
                      <Input type="number" value={form.max_passengers ?? vehicle.max_passengers}
                        onChange={(e) => setEditForm(f => ({ ...f, max_passengers: parseInt(e.target.value) || 1 }))}
                        className="h-9" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Icon</Label>
                      <div className="flex gap-2">
                        {iconOptions.map((opt) => (
                          <button key={opt.value}
                            onClick={() => setEditForm(f => ({ ...f, icon: opt.value }))}
                            className={`p-2 rounded-lg border-2 transition-colors ${(form.icon || vehicle.icon) === opt.value ? "border-primary bg-primary/10" : "border-border"}`}
                          >
                            <opt.icon className="h-4 w-4" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add Vehicle Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Vehicle Type</DialogTitle>
            <DialogDescription>Configure a new vehicle class with its pricing</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Display Name</Label>
                <Input value={newVehicle.display_name || ""} onChange={(e) => setNewVehicle(v => ({ ...v, display_name: e.target.value }))} placeholder="e.g. Economy" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Slug</Label>
                <Input value={newVehicle.name || ""} onChange={(e) => setNewVehicle(v => ({ ...v, name: e.target.value }))} placeholder="e.g. economy" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Base Fare (R)</Label><Input type="number" value={newVehicle.base_fare} onChange={(e) => setNewVehicle(v => ({ ...v, base_fare: parseFloat(e.target.value) || 0 }))} /></div>
              <div className="space-y-1"><Label className="text-xs">Per KM Rate (R)</Label><Input type="number" value={newVehicle.per_km_rate} onChange={(e) => setNewVehicle(v => ({ ...v, per_km_rate: parseFloat(e.target.value) || 0 }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Per Minute Rate (R)</Label><Input type="number" value={newVehicle.per_minute_rate} onChange={(e) => setNewVehicle(v => ({ ...v, per_minute_rate: parseFloat(e.target.value) || 0 }))} /></div>
              <div className="space-y-1"><Label className="text-xs">Minimum Fare (R)</Label><Input type="number" value={newVehicle.minimum_fare} onChange={(e) => setNewVehicle(v => ({ ...v, minimum_fare: parseFloat(e.target.value) || 0 }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Max Passengers</Label><Input type="number" value={newVehicle.max_passengers} onChange={(e) => setNewVehicle(v => ({ ...v, max_passengers: parseInt(e.target.value) || 1 }))} /></div>
              <div className="space-y-1">
                <Label className="text-xs">Icon</Label>
                <div className="flex gap-2">
                  {iconOptions.map((opt) => (
                    <button key={opt.value} onClick={() => setNewVehicle(v => ({ ...v, icon: opt.value }))}
                      className={`p-2 rounded-lg border-2 transition-colors ${newVehicle.icon === opt.value ? "border-primary bg-primary/10" : "border-border"}`}>
                      <opt.icon className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAddVehicle}>Add Vehicle Type</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminRidePricing;
