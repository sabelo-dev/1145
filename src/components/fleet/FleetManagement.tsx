import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  Car, Users, Wrench, Plus, MapPin, Shield,
  AlertTriangle, CheckCircle, Truck, BarChart3,
} from "lucide-react";

interface Vehicle {
  id: string;
  registration_number: string;
  make: string;
  model: string;
  year: number | null;
  color: string | null;
  vehicle_type_id: string | null;
  status: string;
  assigned_driver_id: string | null;
  fleet_id: string | null;
  created_at: string;
}

interface Fleet {
  id: string;
  name: string;
  owner_id: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

const FleetManagement: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [fleets, setFleets] = useState<Fleet[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [showAddFleet, setShowAddFleet] = useState(false);
  const [newVehicle, setNewVehicle] = useState({
    registration_number: "", make: "", model: "", year: "", color: "", fleet_id: "",
  });
  const [newFleet, setNewFleet] = useState({ name: "", description: "" });

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [fleetsRes, vehiclesRes, driversRes] = await Promise.all([
      supabase.from("fleets").select("*").order("created_at", { ascending: false }),
      supabase.from("vehicles").select("*").order("created_at", { ascending: false }),
      supabase.from("drivers").select("id, name, status, rating, user_id").order("name"),
    ]);

    if (fleetsRes.data) setFleets(fleetsRes.data);
    if (vehiclesRes.data) setVehicles(vehiclesRes.data as Vehicle[]);
    if (driversRes.data) setDrivers(driversRes.data);
    setLoading(false);
  };

  const addFleet = async () => {
    if (!user || !newFleet.name.trim()) return;
    const { error } = await supabase.from("fleets").insert({
      name: newFleet.name, description: newFleet.description || null, owner_id: user.id,
    });
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: "Fleet Created" });
      setNewFleet({ name: "", description: "" });
      setShowAddFleet(false);
      fetchAll();
    }
  };

  const addVehicle = async () => {
    if (!newVehicle.registration_number.trim() || !newVehicle.make.trim()) return;
    const { error } = await supabase.from("vehicles").insert({
      registration_number: newVehicle.registration_number,
      make: newVehicle.make,
      model: newVehicle.model,
      year: newVehicle.year ? parseInt(newVehicle.year) : null,
      color: newVehicle.color || null,
      fleet_id: newVehicle.fleet_id || null,
      status: "active",
    });
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: "Vehicle Added" });
      setNewVehicle({ registration_number: "", make: "", model: "", year: "", color: "", fleet_id: "" });
      setShowAddVehicle(false);
      fetchAll();
    }
  };

  const assignDriver = async (vehicleId: string, driverId: string | null) => {
    const { error } = await supabase
      .from("vehicles")
      .update({ assigned_driver_id: driverId })
      .eq("id", vehicleId);
    if (!error) {
      toast({ title: "Driver Assigned" });
      fetchAll();
    }
  };

  const updateVehicleStatus = async (vehicleId: string, status: string) => {
    await supabase.from("vehicles").update({ status }).eq("id", vehicleId);
    fetchAll();
  };

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      active: "bg-green-600", maintenance: "bg-amber-500", inactive: "bg-red-500",
    };
    return map[s] || "bg-muted";
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="vehicles">
        <TabsList>
          <TabsTrigger value="vehicles"><Car className="h-4 w-4 mr-2" />Vehicles</TabsTrigger>
          <TabsTrigger value="fleets"><Truck className="h-4 w-4 mr-2" />Fleets</TabsTrigger>
          <TabsTrigger value="overview"><BarChart3 className="h-4 w-4 mr-2" />Overview</TabsTrigger>
        </TabsList>

        {/* Vehicles Tab */}
        <TabsContent value="vehicles" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Vehicles ({vehicles.length})</h2>
            <Dialog open={showAddVehicle} onOpenChange={setShowAddVehicle}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Add Vehicle</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Register Vehicle</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>Registration Number *</Label><Input value={newVehicle.registration_number} onChange={(e) => setNewVehicle({ ...newVehicle, registration_number: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Make *</Label><Input value={newVehicle.make} onChange={(e) => setNewVehicle({ ...newVehicle, make: e.target.value })} /></div>
                    <div><Label>Model</Label><Input value={newVehicle.model} onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Year</Label><Input type="number" value={newVehicle.year} onChange={(e) => setNewVehicle({ ...newVehicle, year: e.target.value })} /></div>
                    <div><Label>Color</Label><Input value={newVehicle.color} onChange={(e) => setNewVehicle({ ...newVehicle, color: e.target.value })} /></div>
                  </div>
                  {fleets.length > 0 && (
                    <div>
                      <Label>Assign to Fleet</Label>
                      <Select value={newVehicle.fleet_id} onValueChange={(v) => setNewVehicle({ ...newVehicle, fleet_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select fleet" /></SelectTrigger>
                        <SelectContent>
                          {fleets.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <Button onClick={addVehicle} className="w-full">Register Vehicle</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {vehicles.length === 0 ? (
            <Card><CardContent className="pt-6 text-center py-12">
              <Car className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No vehicles registered yet.</p>
            </CardContent></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {vehicles.map((vehicle) => (
                <Card key={vehicle.id}>
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold">{vehicle.make} {vehicle.model}</h3>
                        <p className="text-sm text-muted-foreground">{vehicle.registration_number}</p>
                        {vehicle.year && <p className="text-xs text-muted-foreground">{vehicle.year} • {vehicle.color}</p>}
                      </div>
                      <Badge className={`${statusColor(vehicle.status)} text-white`}>{vehicle.status}</Badge>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Assigned Driver</Label>
                      <Select
                        value={vehicle.assigned_driver_id || "none"}
                        onValueChange={(v) => assignDriver(vehicle.id, v === "none" ? null : v)}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Unassigned</SelectItem>
                          {drivers.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex gap-2 mt-3">
                      {vehicle.status !== "active" && (
                        <Button size="sm" variant="outline" onClick={() => updateVehicleStatus(vehicle.id, "active")}>
                          <CheckCircle className="h-3 w-3 mr-1" />Activate
                        </Button>
                      )}
                      {vehicle.status === "active" && (
                        <Button size="sm" variant="outline" onClick={() => updateVehicleStatus(vehicle.id, "maintenance")}>
                          <Wrench className="h-3 w-3 mr-1" />Maintenance
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Fleets Tab */}
        <TabsContent value="fleets" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Fleets ({fleets.length})</h2>
            <Dialog open={showAddFleet} onOpenChange={setShowAddFleet}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Create Fleet</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create Fleet</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>Fleet Name *</Label><Input value={newFleet.name} onChange={(e) => setNewFleet({ ...newFleet, name: e.target.value })} /></div>
                  <div><Label>Description</Label><Input value={newFleet.description} onChange={(e) => setNewFleet({ ...newFleet, description: e.target.value })} /></div>
                  <Button onClick={addFleet} className="w-full">Create Fleet</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {fleets.length === 0 ? (
            <Card><CardContent className="pt-6 text-center py-12">
              <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No fleets created yet.</p>
            </CardContent></Card>
          ) : (
            <div className="grid gap-4">
              {fleets.map((fleet) => {
                const fleetVehicles = vehicles.filter((v) => v.fleet_id === fleet.id);
                return (
                  <Card key={fleet.id}>
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-lg">{fleet.name}</h3>
                          {fleet.description && <p className="text-sm text-muted-foreground">{fleet.description}</p>}
                        </div>
                        <Badge variant={fleet.is_active ? "default" : "secondary"}>
                          {fleet.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <div className="flex gap-4 mt-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><Car className="h-4 w-4" />{fleetVehicles.length} vehicles</span>
                        <span className="flex items-center gap-1">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          {fleetVehicles.filter((v) => v.status === "active").length} active
                        </span>
                        <span className="flex items-center gap-1">
                          <Wrench className="h-4 w-4 text-amber-500" />
                          {fleetVehicles.filter((v) => v.status === "maintenance").length} maintenance
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Vehicles</CardTitle>
                <Car className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{vehicles.length}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{vehicles.filter((v) => v.status === "active").length}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">In Maintenance</CardTitle>
                <Wrench className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{vehicles.filter((v) => v.status === "maintenance").length}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Drivers</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{drivers.length}</div></CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FleetManagement;
