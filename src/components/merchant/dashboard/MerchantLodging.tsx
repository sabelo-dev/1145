import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Building2, Plus, Star, MapPin, Users, Calendar, DollarSign,
  Eye, Edit, Trash2, ToggleLeft, Image as ImageIcon, Wifi, Car,
  UtensilsCrossed, Waves, Wind, Dumbbell, Coffee, ShieldCheck
} from "lucide-react";

interface LodgingProperty {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  type: string;
  location: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  images: any;
  amenities: any;
  rating: number | null;
  review_count: number | null;
  price_per_night: number;
  currency: string | null;
  max_guests: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  check_in_time: string | null;
  check_out_time: string | null;
  cancellation_policy: string | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

interface BookingRecord {
  id: string;
  property_id: string;
  user_id: string;
  check_in: string;
  check_out: string;
  guests: number | null;
  total_price: number;
  status: string;
  payment_status: string | null;
  special_requests: string | null;
  created_at: string;
}

const AMENITY_OPTIONS = [
  { value: "wifi", label: "WiFi", icon: Wifi },
  { value: "parking", label: "Parking", icon: Car },
  { value: "breakfast", label: "Breakfast", icon: UtensilsCrossed },
  { value: "pool", label: "Pool", icon: Waves },
  { value: "aircon", label: "Air Conditioning", icon: Wind },
  { value: "gym", label: "Gym", icon: Dumbbell },
  { value: "coffee", label: "Coffee/Tea", icon: Coffee },
  { value: "security", label: "24h Security", icon: ShieldCheck },
];

const PROPERTY_TYPES = [
  { value: "hotel", label: "Hotel" },
  { value: "airbnb", label: "Airbnb" },
  { value: "guesthouse", label: "Guesthouse" },
  { value: "lodge", label: "Lodge" },
  { value: "hostel", label: "Hostel" },
];

const emptyForm = {
  name: "", description: "", type: "hotel", location: "", address: "",
  city: "", province: "", country: "South Africa", price_per_night: "",
  max_guests: "2", bedrooms: "1", bathrooms: "1",
  check_in_time: "14:00", check_out_time: "11:00",
  cancellation_policy: "flexible", amenities: [] as string[],
  images: [] as string[], is_active: true,
};

const MerchantLodging = () => {
  const { user } = useAuth();
  const [properties, setProperties] = useState<LodgingProperty[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    const [propRes, bookRes] = await Promise.all([
      (supabase as any).from("lodging_properties").select("*").eq("owner_id", user.id).order("created_at", { ascending: false }),
      (supabase as any).from("lodging_bookings").select("*").order("created_at", { ascending: false }),
    ]);

    if (propRes.data) {
      setProperties(propRes.data);
      const propIds = propRes.data.map((p: any) => p.id);
      if (propIds.length && bookRes.data) {
        setBookings(bookRes.data.filter((b: any) => propIds.includes(b.property_id)));
      }
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async () => {
    if (!user?.id || !form.name || !form.price_per_night) {
      toast.error("Please fill in required fields");
      return;
    }
    setSaving(true);

    const payload = {
      owner_id: user.id,
      name: form.name,
      description: form.description || null,
      type: form.type,
      location: form.location || null,
      address: form.address || null,
      city: form.city || null,
      province: form.province || null,
      country: form.country || null,
      price_per_night: parseFloat(form.price_per_night),
      max_guests: parseInt(form.max_guests) || 2,
      bedrooms: parseInt(form.bedrooms) || 1,
      bathrooms: parseInt(form.bathrooms) || 1,
      check_in_time: form.check_in_time,
      check_out_time: form.check_out_time,
      cancellation_policy: form.cancellation_policy,
      amenities: form.amenities,
      images: form.images,
      is_active: form.is_active,
    };

    let res;
    if (editingId) {
      res = await (supabase as any).from("lodging_properties").update(payload).eq("id", editingId);
    } else {
      res = await (supabase as any).from("lodging_properties").insert(payload);
    }

    if (res.error) {
      toast.error(res.error.message);
    } else {
      toast.success(editingId ? "Property updated" : "Property listed successfully");
      setShowAddDialog(false);
      setEditingId(null);
      setForm({ ...emptyForm });
      fetchData();
    }
    setSaving(false);
  };

  const toggleActive = async (id: string, current: boolean) => {
    await (supabase as any).from("lodging_properties").update({ is_active: !current }).eq("id", id);
    fetchData();
  };

  const deleteProperty = async (id: string) => {
    if (!confirm("Delete this property?")) return;
    await (supabase as any).from("lodging_properties").delete().eq("id", id);
    toast.success("Property deleted");
    fetchData();
  };

  const editProperty = (p: LodgingProperty) => {
    setEditingId(p.id);
    setForm({
      name: p.name, description: p.description || "", type: p.type,
      location: p.location || "", address: p.address || "",
      city: p.city || "", province: p.province || "", country: p.country || "South Africa",
      price_per_night: p.price_per_night.toString(),
      max_guests: (p.max_guests || 2).toString(),
      bedrooms: (p.bedrooms || 1).toString(),
      bathrooms: (p.bathrooms || 1).toString(),
      check_in_time: p.check_in_time || "14:00",
      check_out_time: p.check_out_time || "11:00",
      cancellation_policy: p.cancellation_policy || "flexible",
      amenities: Array.isArray(p.amenities) ? p.amenities : [],
      images: Array.isArray(p.images) ? p.images : [],
      is_active: p.is_active ?? true,
    });
    setShowAddDialog(true);
  };

  const updateBookingStatus = async (id: string, status: string) => {
    await (supabase as any).from("lodging_bookings").update({ status }).eq("id", id);
    toast.success(`Booking ${status}`);
    fetchData();
  };

  const toggleAmenity = (amenity: string) => {
    setForm(f => ({
      ...f,
      amenities: f.amenities.includes(amenity)
        ? f.amenities.filter(a => a !== amenity)
        : [...f.amenities, amenity],
    }));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const activeProps = properties.filter(p => p.is_active);
  const totalRevenue = bookings.filter(b => b.status === "confirmed" || b.status === "checked_out").reduce((s, b) => s + b.total_price, 0);
  const pendingBookings = bookings.filter(b => b.status === "pending");
  const avgRating = properties.length ? (properties.reduce((s, p) => s + (p.rating || 0), 0) / properties.filter(p => p.rating).length || 0) : 0;

  const stats = [
    { label: "Properties", value: properties.length, icon: Building2, color: "text-primary", bg: "bg-primary/10" },
    { label: "Active Listings", value: activeProps.length, icon: Eye, color: "text-emerald-600", bg: "bg-emerald-500/10" },
    { label: "Pending Bookings", value: pendingBookings.length, icon: Calendar, color: "text-amber-600", bg: "bg-amber-500/10" },
    { label: "Total Revenue", value: `R${totalRevenue.toLocaleString()}`, icon: DollarSign, color: "text-blue-600", bg: "bg-blue-500/10" },
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(s => (
          <Card key={s.label} className="border-0 ring-1 ring-border">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{s.label}</p>
                  <p className="text-2xl font-black mt-1 tracking-tight">{s.value}</p>
                </div>
                <div className={`p-2 rounded-xl ${s.bg}`}><s.icon className={`h-5 w-5 ${s.color}`} /></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="properties">
        <div className="flex items-center justify-between">
          <TabsList className="rounded-xl">
            <TabsTrigger value="properties" className="rounded-lg">Properties ({properties.length})</TabsTrigger>
            <TabsTrigger value="bookings" className="rounded-lg">Bookings ({bookings.length})</TabsTrigger>
          </TabsList>

          <Dialog open={showAddDialog} onOpenChange={(open) => {
            setShowAddDialog(open);
            if (!open) { setEditingId(null); setForm({ ...emptyForm }); }
          }}>
            <DialogTrigger asChild>
              <Button className="rounded-xl gap-2"><Plus className="h-4 w-4" />Add Property</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit Property" : "List a New Property"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-5 pt-2">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Property Name *</Label>
                    <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Ocean View Lodge" />
                  </div>
                  <div className="space-y-2">
                    <Label>Property Type *</Label>
                    <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PROPERTY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe your property..." rows={3} />
                </div>

                <Separator />

                {/* Location */}
                <h4 className="font-semibold text-sm text-foreground">Location</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="123 Main Street" />
                  </div>
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Cape Town" />
                  </div>
                  <div className="space-y-2">
                    <Label>Province</Label>
                    <Input value={form.province} onChange={e => setForm(f => ({ ...f, province: e.target.value }))} placeholder="Western Cape" />
                  </div>
                  <div className="space-y-2">
                    <Label>Country</Label>
                    <Input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} />
                  </div>
                </div>

                <Separator />

                {/* Pricing & Capacity */}
                <h4 className="font-semibold text-sm text-foreground">Pricing & Capacity</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Price/Night (R) *</Label>
                    <Input type="number" value={form.price_per_night} onChange={e => setForm(f => ({ ...f, price_per_night: e.target.value }))} placeholder="500" />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Guests</Label>
                    <Input type="number" value={form.max_guests} onChange={e => setForm(f => ({ ...f, max_guests: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Bedrooms</Label>
                    <Input type="number" value={form.bedrooms} onChange={e => setForm(f => ({ ...f, bedrooms: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Bathrooms</Label>
                    <Input type="number" value={form.bathrooms} onChange={e => setForm(f => ({ ...f, bathrooms: e.target.value }))} />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Check-in Time</Label>
                    <Input type="time" value={form.check_in_time} onChange={e => setForm(f => ({ ...f, check_in_time: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Check-out Time</Label>
                    <Input type="time" value={form.check_out_time} onChange={e => setForm(f => ({ ...f, check_out_time: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Cancellation Policy</Label>
                    <Select value={form.cancellation_policy} onValueChange={v => setForm(f => ({ ...f, cancellation_policy: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="flexible">Flexible</SelectItem>
                        <SelectItem value="moderate">Moderate</SelectItem>
                        <SelectItem value="strict">Strict</SelectItem>
                        <SelectItem value="non_refundable">Non-refundable</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                {/* Amenities */}
                <h4 className="font-semibold text-sm text-foreground">Amenities</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {AMENITY_OPTIONS.map(a => {
                    const selected = form.amenities.includes(a.value);
                    return (
                      <button
                        key={a.value}
                        type="button"
                        onClick={() => toggleAmenity(a.value)}
                        className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all ${
                          selected ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"
                        }`}
                      >
                        <a.icon className="h-4 w-4" />
                        {a.label}
                      </button>
                    );
                  })}
                </div>

                <Separator />

                {/* Active Toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Active Listing</Label>
                    <p className="text-xs text-muted-foreground">Make this property visible to guests</p>
                  </div>
                  <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
                </div>

                <Button onClick={handleSubmit} disabled={saving} className="w-full rounded-xl">
                  {saving ? "Saving..." : editingId ? "Update Property" : "List Property"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Properties Tab */}
        <TabsContent value="properties">
          {properties.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-muted mb-4">
                  <Building2 className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-1">No Properties Listed</h3>
                <p className="text-sm text-muted-foreground mb-4">Start earning by listing your hotel, Airbnb, or lodge.</p>
                <Button onClick={() => setShowAddDialog(true)} className="rounded-xl gap-2">
                  <Plus className="h-4 w-4" />Add Your First Property
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {properties.map(p => (
                <Card key={p.id} className="border-0 ring-1 ring-border hover:shadow-md transition-all">
                  <CardContent className="p-5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-lg">{p.name}</h3>
                          <Badge variant={p.is_active ? "default" : "secondary"} className="rounded-full capitalize">
                            {p.is_active ? "Active" : "Inactive"}
                          </Badge>
                          <Badge variant="outline" className="rounded-full capitalize">{p.type}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {p.city && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{p.city}{p.province ? `, ${p.province}` : ""}</span>}
                          <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{p.max_guests || 2} guests</span>
                          {p.rating ? <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 text-amber-500" />{p.rating.toFixed(1)}</span> : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right mr-2">
                          <p className="text-xl font-black tracking-tight">R{p.price_per_night.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">per night</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => editProperty(p)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => toggleActive(p.id, p.is_active ?? true)}>
                          <ToggleLeft className={`h-4 w-4 ${p.is_active ? "text-emerald-500" : "text-muted-foreground"}`} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteProperty(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </div>
                    {Array.isArray(p.amenities) && p.amenities.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {p.amenities.map((a: string) => {
                          const am = AMENITY_OPTIONS.find(o => o.value === a);
                          return am ? (
                            <Badge key={a} variant="outline" className="rounded-full text-xs gap-1">
                              <am.icon className="h-3 w-3" />{am.label}
                            </Badge>
                          ) : null;
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Bookings Tab */}
        <TabsContent value="bookings">
          <Card className="border-0 ring-1 ring-border">
            <CardContent className="p-0">
              {bookings.length === 0 ? (
                <div className="text-center py-16">
                  <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-muted mb-4">
                    <Calendar className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-lg mb-1">No Bookings Yet</h3>
                  <p className="text-sm text-muted-foreground">Bookings from guests will appear here.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Property</TableHead>
                      <TableHead>Check-in</TableHead>
                      <TableHead>Check-out</TableHead>
                      <TableHead>Guests</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookings.map(b => {
                      const prop = properties.find(p => p.id === b.property_id);
                      return (
                        <TableRow key={b.id} className="hover:bg-muted/30">
                          <TableCell className="font-medium">{prop?.name || "Unknown"}</TableCell>
                          <TableCell className="text-sm">{new Date(b.check_in).toLocaleDateString()}</TableCell>
                          <TableCell className="text-sm">{new Date(b.check_out).toLocaleDateString()}</TableCell>
                          <TableCell>{b.guests || 1}</TableCell>
                          <TableCell className="font-mono">R{b.total_price.toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant={
                              b.status === "confirmed" ? "default" :
                              b.status === "cancelled" ? "destructive" : "secondary"
                            } className="rounded-full capitalize">{b.status}</Badge>
                          </TableCell>
                          <TableCell>
                            {b.status === "pending" && (
                              <div className="flex gap-1">
                                <Button size="sm" variant="default" className="rounded-lg text-xs h-7" onClick={() => updateBookingStatus(b.id, "confirmed")}>
                                  Confirm
                                </Button>
                                <Button size="sm" variant="destructive" className="rounded-lg text-xs h-7" onClick={() => updateBookingStatus(b.id, "cancelled")}>
                                  Decline
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MerchantLodging;
