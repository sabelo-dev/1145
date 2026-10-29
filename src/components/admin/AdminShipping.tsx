import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, MapPin } from "lucide-react";

interface ShippingZone {
  id: string;
  name: string;
  countries: any;
  provinces: any;
  postal_codes: any;
  is_active: boolean;
  created_at: string;
}

interface ShippingRate {
  id: string;
  zone_id: string;
  name: string;
  rate_type: string;
  min_order_value: number;
  max_order_value: number | null;
  min_weight: number;
  max_weight: number | null;
  price: number;
  free_shipping_threshold: number | null;
  is_active: boolean;
  shipping_zones?: { name: string };
}

export const AdminShipping = () => {
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [rates, setRates] = useState<ShippingRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [rateDialogOpen, setRateDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<ShippingZone | null>(null);
  const [editingRate, setEditingRate] = useState<ShippingRate | null>(null);

  const [zoneForm, setZoneForm] = useState({
    name: "",
    countries: "",
    provinces: "",
    is_active: true,
  });

  const [rateForm, setRateForm] = useState({
    zone_id: "",
    name: "",
    rate_type: "order_value",
    min_order_value: 0,
    max_order_value: "",
    price: 0,
    free_shipping_threshold: "",
    is_active: true,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [zonesRes, ratesRes] = await Promise.all([
        supabase.from("shipping_zones").select("*").order("created_at", { ascending: false }),
        supabase.from("shipping_rates").select("*, shipping_zones(name)").order("created_at", { ascending: false }),
      ]);

      if (zonesRes.error) throw zonesRes.error;
      if (ratesRes.error) throw ratesRes.error;

      setZones(zonesRes.data as any || []);
      setRates(ratesRes.data as any || []);
    } catch (error: any) {
      toast.error("Failed to fetch shipping data: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveZone = async () => {
    try {
      const zoneData = {
        name: zoneForm.name,
        countries: zoneForm.countries.split(",").map(c => c.trim()),
        provinces: zoneForm.provinces.split(",").map(p => p.trim()),
        is_active: zoneForm.is_active,
      };

      if (editingZone) {
        const { error } = await supabase
          .from("shipping_zones")
          .update(zoneData)
          .eq("id", editingZone.id);
        if (error) throw error;
        toast.success("Zone updated successfully");
      } else {
        const { error } = await supabase.from("shipping_zones").insert(zoneData);
        if (error) throw error;
        toast.success("Zone created successfully");
      }

      setDialogOpen(false);
      resetZoneForm();
      fetchData();
    } catch (error: any) {
      toast.error("Failed to save zone: " + error.message);
    }
  };

  const handleSaveRate = async () => {
    try {
      const rateData = {
        zone_id: rateForm.zone_id,
        name: rateForm.name,
        rate_type: rateForm.rate_type,
        min_order_value: rateForm.min_order_value,
        max_order_value: rateForm.max_order_value ? parseFloat(rateForm.max_order_value) : null,
        price: rateForm.price,
        free_shipping_threshold: rateForm.free_shipping_threshold ? parseFloat(rateForm.free_shipping_threshold) : null,
        is_active: rateForm.is_active,
      };

      if (editingRate) {
        const { error } = await supabase
          .from("shipping_rates")
          .update(rateData)
          .eq("id", editingRate.id);
        if (error) throw error;
        toast.success("Rate updated successfully");
      } else {
        const { error } = await supabase.from("shipping_rates").insert(rateData);
        if (error) throw error;
        toast.success("Rate created successfully");
      }

      setRateDialogOpen(false);
      resetRateForm();
      fetchData();
    } catch (error: any) {
      toast.error("Failed to save rate: " + error.message);
    }
  };

  const handleDeleteZone = async (id: string) => {
    if (!confirm("Are you sure you want to delete this zone? All associated rates will be deleted.")) return;
    
    try {
      const { error } = await supabase.from("shipping_zones").delete().eq("id", id);
      if (error) throw error;
      toast.success("Zone deleted successfully");
      fetchData();
    } catch (error: any) {
      toast.error("Failed to delete zone: " + error.message);
    }
  };

  const handleDeleteRate = async (id: string) => {
    if (!confirm("Are you sure you want to delete this rate?")) return;
    
    try {
      const { error } = await supabase.from("shipping_rates").delete().eq("id", id);
      if (error) throw error;
      toast.success("Rate deleted successfully");
      fetchData();
    } catch (error: any) {
      toast.error("Failed to delete rate: " + error.message);
    }
  };

  const openEditZone = (zone: ShippingZone) => {
    setEditingZone(zone);
    setZoneForm({
      name: zone.name,
      countries: zone.countries.join(", "),
      provinces: zone.provinces.join(", "),
      is_active: zone.is_active,
    });
    setDialogOpen(true);
  };

  const openEditRate = (rate: ShippingRate) => {
    setEditingRate(rate);
    setRateForm({
      zone_id: rate.zone_id,
      name: rate.name,
      rate_type: rate.rate_type,
      min_order_value: rate.min_order_value,
      max_order_value: rate.max_order_value?.toString() || "",
      price: rate.price,
      free_shipping_threshold: rate.free_shipping_threshold?.toString() || "",
      is_active: rate.is_active,
    });
    setRateDialogOpen(true);
  };

  const resetZoneForm = () => {
    setEditingZone(null);
    setZoneForm({
      name: "",
      countries: "",
      provinces: "",
      is_active: true,
    });
  };

  const resetRateForm = () => {
    setEditingRate(null);
    setRateForm({
      zone_id: "",
      name: "",
      rate_type: "order_value",
      min_order_value: 0,
      max_order_value: "",
      price: 0,
      free_shipping_threshold: "",
      is_active: true,
    });
  };

  if (loading) {
    return <div className="p-6">Loading shipping configuration...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h2 className="text-3xl font-bold">Shipping Management</h2>
          <p className="text-muted-foreground">Manage shipping zones and rates</p>
        </div>
      </div>

      <Tabs defaultValue="rates" className="w-full">
        <TabsList>
          <TabsTrigger value="rates">Shipping Rates</TabsTrigger>
          <TabsTrigger value="zones">Shipping Zones</TabsTrigger>
        </TabsList>

        <TabsContent value="rates" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
                <div>
                  <CardTitle>Shipping Rates</CardTitle>
                  <CardDescription>Configure shipping rates based on order value, weight, or region</CardDescription>
                </div>
                <Dialog open={rateDialogOpen} onOpenChange={setRateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={resetRateForm}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Rate
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>{editingRate ? "Edit Shipping Rate" : "Add Shipping Rate"}</DialogTitle>
                      <DialogDescription>Configure shipping rate details</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="rate-zone">Shipping Zone</Label>
                        <Select value={rateForm.zone_id} onValueChange={(value) => setRateForm({ ...rateForm, zone_id: value })}>
                          <SelectTrigger id="rate-zone">
                            <SelectValue placeholder="Select zone" />
                          </SelectTrigger>
                          <SelectContent>
                            {zones.map((zone) => (
                              <SelectItem key={zone.id} value={zone.id}>{zone.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="rate-name">Rate Name</Label>
                        <Input
                          id="rate-name"
                          value={rateForm.name}
                          onChange={(e) => setRateForm({ ...rateForm, name: e.target.value })}
                          placeholder="e.g., Standard Shipping"
                        />
                      </div>
                      <div>
                        <Label htmlFor="rate-type">Rate Type</Label>
                        <Select value={rateForm.rate_type} onValueChange={(value: any) => setRateForm({ ...rateForm, rate_type: value })}>
                          <SelectTrigger id="rate-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="flat">Flat Rate</SelectItem>
                            <SelectItem value="order_value">Order Value Based</SelectItem>
                            <SelectItem value="weight_based">Weight Based</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="min-order">Min Order Value (R)</Label>
                          <Input
                            id="min-order"
                            type="number"
                            value={rateForm.min_order_value}
                            onChange={(e) => setRateForm({ ...rateForm, min_order_value: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="max-order">Max Order Value (R)</Label>
                          <Input
                            id="max-order"
                            type="number"
                            value={rateForm.max_order_value}
                            onChange={(e) => setRateForm({ ...rateForm, max_order_value: e.target.value })}
                            placeholder="Optional"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="price">Shipping Price (R)</Label>
                          <Input
                            id="price"
                            type="number"
                            value={rateForm.price}
                            onChange={(e) => setRateForm({ ...rateForm, price: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="free-threshold">Free Shipping At (R)</Label>
                          <Input
                            id="free-threshold"
                            type="number"
                            value={rateForm.free_shipping_threshold}
                            onChange={(e) => setRateForm({ ...rateForm, free_shipping_threshold: e.target.value })}
                            placeholder="Optional"
                          />
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="rate-active"
                          checked={rateForm.is_active}
                          onCheckedChange={(checked) => setRateForm({ ...rateForm, is_active: checked })}
                        />
                        <Label htmlFor="rate-active">Active</Label>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setRateDialogOpen(false)}>Cancel</Button>
                      <Button onClick={handleSaveRate}>Save Rate</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Zone</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Order Range</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Free Shipping</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rates.map((rate) => (
                    <TableRow key={rate.id}>
                      <TableCell className="font-medium">{rate.name}</TableCell>
                      <TableCell>{rate.shipping_zones?.name}</TableCell>
                      <TableCell className="capitalize">{rate.rate_type.replace('_', ' ')}</TableCell>
                      <TableCell>
                        R{rate.min_order_value} - {rate.max_order_value ? `R${rate.max_order_value}` : '∞'}
                      </TableCell>
                      <TableCell>R{rate.price}</TableCell>
                      <TableCell>
                        {rate.free_shipping_threshold ? `R${rate.free_shipping_threshold}` : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={rate.is_active ? "default" : "secondary"}>
                          {rate.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openEditRate(rate)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteRate(rate.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="zones" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
                <div>
                  <CardTitle>Shipping Zones</CardTitle>
                  <CardDescription>Define geographic regions for shipping</CardDescription>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={resetZoneForm}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Zone
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingZone ? "Edit Shipping Zone" : "Add Shipping Zone"}</DialogTitle>
                      <DialogDescription>Define a geographic shipping zone</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="zone-name">Zone Name</Label>
                        <Input
                          id="zone-name"
                          value={zoneForm.name}
                          onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })}
                          placeholder="e.g., South Africa - Major Cities"
                        />
                      </div>
                      <div>
                        <Label htmlFor="countries">Countries (ISO codes, comma-separated)</Label>
                        <Input
                          id="countries"
                          value={zoneForm.countries}
                          onChange={(e) => setZoneForm({ ...zoneForm, countries: e.target.value })}
                          placeholder="e.g., ZA, US, GB"
                        />
                      </div>
                      <div>
                        <Label htmlFor="provinces">Provinces/States (comma-separated)</Label>
                        <Input
                          id="provinces"
                          value={zoneForm.provinces}
                          onChange={(e) => setZoneForm({ ...zoneForm, provinces: e.target.value })}
                          placeholder="e.g., Gauteng, Western Cape"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="zone-active"
                          checked={zoneForm.is_active}
                          onCheckedChange={(checked) => setZoneForm({ ...zoneForm, is_active: checked })}
                        />
                        <Label htmlFor="zone-active">Active</Label>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                      <Button onClick={handleSaveZone}>Save Zone</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zone Name</TableHead>
                    <TableHead>Countries</TableHead>
                    <TableHead>Provinces</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {zones.map((zone) => (
                    <TableRow key={zone.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          {zone.name}
                        </div>
                      </TableCell>
                      <TableCell>{zone.countries.join(", ")}</TableCell>
                      <TableCell>{zone.provinces.length > 0 ? zone.provinces.join(", ") : "All"}</TableCell>
                      <TableCell>
                        <Badge variant={zone.is_active ? "default" : "secondary"}>
                          {zone.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openEditZone(zone)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteZone(zone.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
