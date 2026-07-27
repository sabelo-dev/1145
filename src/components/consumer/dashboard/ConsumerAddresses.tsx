import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Plus, Edit, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Address {
  id: string;
  user_id: string;
  label: string;
  name: string;
  phone: string | null;
  street: string;
  city: string;
  province: string;
  postal_code: string;
  country: string;
  is_default: boolean;
}

type AddressFormValues = Omit<Address, "id" | "user_id">;

const emptyForm: AddressFormValues = {
  label: "Home",
  name: "",
  phone: "",
  street: "",
  city: "",
  province: "",
  postal_code: "",
  country: "South Africa",
  is_default: false,
};

const ConsumerAddresses: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);
  const [form, setForm] = useState<AddressFormValues>(emptyForm);

  const loadAddresses = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("user_addresses")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Failed to load addresses", description: error.message, variant: "destructive" });
    } else {
      setAddresses((data ?? []) as Address[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAddresses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (a: Address) => {
    setEditing(a);
    setForm({
      label: a.label,
      name: a.name,
      phone: a.phone ?? "",
      street: a.street,
      city: a.city,
      province: a.province,
      postal_code: a.postal_code,
      country: a.country,
      is_default: a.is_default,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!form.name || !form.street || !form.city || !form.province || !form.postal_code) {
      toast({ title: "Missing fields", description: "Please fill all required fields.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (form.is_default) {
        // clear other defaults for this user
        await supabase
          .from("user_addresses")
          .update({ is_default: false })
          .eq("user_id", user.id);
      }

      if (editing) {
        const { error } = await supabase
          .from("user_addresses")
          .update({ ...form, phone: form.phone || null })
          .eq("id", editing.id)
          .eq("user_id", user.id);
        if (error) throw error;
        toast({ title: "Address updated" });
      } else {
        const { error } = await supabase
          .from("user_addresses")
          .insert({ ...form, phone: form.phone || null, user_id: user.id });
        if (error) throw error;
        toast({ title: "Address added" });
      }
      setDialogOpen(false);
      await loadAddresses();
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("user_addresses")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Address removed" });
      loadAddresses();
    }
  };

  const AddressForm = (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Full Name</Label>
          <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="phone">Phone Number</Label>
          <Input id="phone" value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
      </div>

      <div>
        <Label htmlFor="label">Address Label</Label>
        <Input
          id="label"
          placeholder="e.g. Home, Office"
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="street">Street Address</Label>
        <Input id="street" value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="city">City</Label>
          <Input id="city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="province">Province</Label>
          <Input id="province" value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="postal_code">Postal Code</Label>
          <Input
            id="postal_code"
            value={form.postal_code}
            onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="country">Country</Label>
        <Input id="country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="is_default"
          checked={form.is_default}
          onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
        />
        <Label htmlFor="is_default">Set as default address</Label>
      </div>

      <div className="flex gap-2 pt-4">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Address"}
        </Button>
        <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          <span className="text-lg font-medium">Shipping Addresses</span>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" />
              Add Address
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Address" : "Add New Address"}</DialogTitle>
            </DialogHeader>
            {AddressForm}
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : addresses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No addresses saved</h3>
            <p className="text-muted-foreground text-center mb-4">
              Add your first shipping address to make checkout faster
            </p>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" />
              Add Address
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {addresses.map((address) => (
            <Card key={address.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{address.label}</CardTitle>
                    {address.is_default && <Badge variant="default">Default</Badge>}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(address)}>
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete(address.id)}>
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-sm">
                  <div className="font-medium">{address.name}</div>
                  {address.phone && <div className="text-muted-foreground">{address.phone}</div>}
                  <div className="text-muted-foreground">{address.street}</div>
                  <div className="text-muted-foreground">
                    {address.city}, {address.province} {address.postal_code}
                  </div>
                  <div className="text-muted-foreground">{address.country}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ConsumerAddresses;
