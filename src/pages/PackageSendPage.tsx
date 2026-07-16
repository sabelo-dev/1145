import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Package as PackageIcon, User, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import SEO from "@/components/SEO";

const PackageSendPage: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    pickup: "",
    dropoff: "",
    recipientName: "",
    recipientPhone: "",
    size: "small",
    notes: "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams({
      mode: "package",
      pickup: form.pickup,
      destination: form.dropoff,
      recipientName: form.recipientName,
      recipientPhone: form.recipientPhone,
      size: form.size,
      notes: form.notes,
    });
    navigate(`/rides/request?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SEO
        title="Send a Package — 1145"
        description="Send parcels across the city with 1145 Package. Fast, tracked, on-demand delivery."
      />
      <Header />
      <main className="flex-1">
        <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground mb-2">
              <PackageIcon className="h-3.5 w-3.5" /> Package & Send
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Send a package</h1>
            <p className="text-muted-foreground mt-2">On-demand courier — matched with a nearby 1145 driver.</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4 bg-muted/40 border border-border rounded-2xl p-5 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="relative sm:col-span-2">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input required value={form.pickup} onChange={set("pickup")} placeholder="Pickup address" className="pl-11 h-12" />
              </div>
              <div className="relative sm:col-span-2">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input required value={form.dropoff} onChange={set("dropoff")} placeholder="Dropoff address" className="pl-11 h-12" />
              </div>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input required value={form.recipientName} onChange={set("recipientName")} placeholder="Recipient name" className="pl-11 h-12" />
              </div>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input required value={form.recipientPhone} onChange={set("recipientPhone")} placeholder="Recipient phone" className="pl-11 h-12" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Package size</label>
                <Select value={form.size} onValueChange={(v) => setForm((f) => ({ ...f, size: v }))}>
                  <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small — fits in a backpack</SelectItem>
                    <SelectItem value="medium">Medium — box up to 10kg</SelectItem>
                    <SelectItem value="large">Large — bakkie load</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Textarea value={form.notes} onChange={set("notes")} placeholder="Delivery instructions (optional)" rows={3} />
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button type="submit" className="h-11 px-6 font-medium">Get a quote</Button>
              <Button type="button" variant="ghost" className="h-11" onClick={() => navigate("/")}>Cancel</Button>
            </div>
          </form>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default PackageSendPage;
